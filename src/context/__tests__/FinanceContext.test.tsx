import { act, renderHook, waitFor } from '@testing-library/react-native';
import { FinanceProvider, useFinance, type VaultData } from '../FinanceContext';
import { normalizeVaultData } from '../../types';
import { decryptVaultWithKey, deriveVaultKey } from '../../utils/cryptoWrapper';
import { showAlert } from '../../utils/dialogs';
import { mockVaultFile, resetNativeMocks } from '../../test-utils/nativeMocks';

// The vault file lives in memory; encryption is the real thing.
jest.mock('../../utils/storageAdapter', () => require('../../test-utils/nativeMocks').storageAdapterMock);
jest.mock('../../utils/biometrics', () => require('../../test-utils/nativeMocks').biometricsMock);
jest.mock('../../utils/notifications', () => require('../../test-utils/nativeMocks').notificationsMock);
jest.mock('../../utils/dialogs', () => require('../../test-utils/nativeMocks').dialogsMock);
jest.mock('expo-file-system', () => require('../../test-utils/nativeMocks').fileSystemMock);
jest.mock('expo-sharing', () => require('../../test-utils/nativeMocks').sharingMock);

const PIN = '123456';

const seed: Partial<VaultData> = {
    incomes: [{ id: 'job', name: 'Job', amount: 1400, frequency: 'biweekly', initialPaymentDate: '2026-09-04' }],
    cards: [
        { id: 'visa', kind: 'card', name: 'Visa', balance: 1000, apr: 20, creditLimit: 5000, plannedPayment: 200, dueDay: 25 },
        { id: 'car', kind: 'loan', name: 'Car', balance: 5000, apr: 5, plannedPayment: 300, dueDay: 20 },
    ],
    budgets: [{ id: 'groc', name: 'Groceries', amount: 500, period: 'monthly', isEssential: true }],
    bills: [{ id: 'rent', name: 'Rent', cost: 1200, frequency: 'monthly', firstPaymentDate: '2026-01-15', isEssential: true }],
};

/** A provider that has been set up with a PIN and loaded with `data`. */
async function openVault(data: Partial<VaultData> = seed) {
    const hook = await renderHook(() => useFinance(), { wrapper: FinanceProvider });
    await waitFor(() => expect(hook.result.current.authStatus).toBe('setup'));
    await act(() => hook.result.current.setupVault(PIN));
    await act(async () => hook.result.current.importData(JSON.stringify(data)));
    return hook;
}

type Hook = Awaited<ReturnType<typeof openVault>>;
const run = (hook: Hook, fn: (finance: Hook['result']['current']) => void) => act(async () => fn(hook.result.current));
const balance = (hook: Hook, id: string) => hook.result.current.cards.find(c => c.id === id)!.balance;

/** What's in the encrypted vault file right now. */
async function storedVault(): Promise<VaultData> {
    const salt = Uint8Array.from(atob(mockVaultFile.value!).slice(0, 16), c => c.charCodeAt(0));
    const key = await deriveVaultKey(PIN, salt);
    return JSON.parse(decryptVaultWithKey(mockVaultFile.value!, key));
}

beforeEach(resetNativeMocks);

describe('vault lifecycle', () => {
    it('creates an encrypted vault when the PIN is set, and saves changes to it', async () => {
        const hook = await openVault();
        expect(hook.result.current.authStatus).toBe('unlocked');
        expect(mockVaultFile.value).not.toContain('Visa');

        await run(hook, f => f.addCardTransaction({ cardId: 'visa', type: 'payment', amount: 100, date: '2026-10-05' }));
        await waitFor(async () => expect((await storedVault()).cardTransactions).toHaveLength(1));
        expect((await storedVault()).cards.find(c => c.id === 'visa')!.balance).toBe(900);
    });

    it('locks, refuses a wrong PIN, and unlocks with the right one with everything intact', async () => {
        const hook = await openVault();
        await run(hook, f => f.setIncomeActual('job', '2026-10-02', 1236.4));
        await run(hook, f => f.addSpending({ budgetId: 'groc', amount: 40, date: '2026-10-06', cardId: 'visa' }));
        await waitFor(async () => expect((await storedVault()).spending).toHaveLength(1));

        await run(hook, f => f.lockVault());
        expect(hook.result.current.authStatus).toBe('locked');
        expect(hook.result.current.cards).toEqual([]);

        let ok = true;
        await act(async () => { ok = await hook.result.current.unlockVault('000000'); });
        expect(ok).toBe(false);
        expect(hook.result.current.authStatus).toBe('locked');

        await act(async () => { ok = await hook.result.current.unlockVault(PIN); });
        expect(ok).toBe(true);
        expect(hook.result.current.authStatus).toBe('unlocked');
        expect(hook.result.current.incomeActuals).toEqual([expect.objectContaining({ incomeId: 'job', payDate: '2026-10-02', amount: 1236.4 })]);
        expect(hook.result.current.spending).toEqual([expect.objectContaining({ amount: 40, cardId: 'visa' })]);
        expect(balance(hook, 'visa')).toBe(1040);
    });

    it('wipes everything', async () => {
        const hook = await openVault();
        await act(() => hook.result.current.clearAllData());
        expect(hook.result.current.authStatus).toBe('setup');
        expect(hook.result.current.cards).toEqual([]);
        expect(mockVaultFile.value).toBeNull();
    });
});

describe('one-off card and loan payments and charges', () => {
    it('lowers the balance for a payment and restores it when the payment is deleted', async () => {
        const hook = await openVault();
        await run(hook, f => f.addCardTransaction({ cardId: 'visa', type: 'payment', amount: 100, date: '2026-10-05', note: 'Bonus' }));
        expect(balance(hook, 'visa')).toBe(900);
        expect(hook.result.current.cardTransactions).toEqual([expect.objectContaining({ cardId: 'visa', type: 'payment', amount: 100, note: 'Bonus' })]);

        await run(hook, f => f.deleteCardTransaction(f.cardTransactions[0].id));
        expect(balance(hook, 'visa')).toBe(1000);
        expect(hook.result.current.cardTransactions).toEqual([]);
    });

    it('raises the balance for a charge, keeping cents exact', async () => {
        const hook = await openVault();
        await run(hook, f => f.addCardTransaction({ cardId: 'visa', type: 'charge', amount: 50.1, date: '2026-10-05' }));
        await run(hook, f => f.addCardTransaction({ cardId: 'visa', type: 'charge', amount: 0.2, date: '2026-10-05' }));
        expect(balance(hook, 'visa')).toBe(1050.3);
        for (const t of [...hook.result.current.cardTransactions]) await run(hook, f => f.deleteCardTransaction(t.id));
        expect(balance(hook, 'visa')).toBe(1000);
    });

    it('only touches the card it was made on', async () => {
        const hook = await openVault();
        await run(hook, f => f.addCardTransaction({ cardId: 'car', type: 'payment', amount: 500, date: '2026-10-05' }));
        expect(balance(hook, 'car')).toBe(4500);
        expect(balance(hook, 'visa')).toBe(1000);
    });

    it('ignores deleting something that is not there', async () => {
        const hook = await openVault();
        const before = hook.result.current.data;
        await run(hook, f => f.deleteCardTransaction('missing'));
        expect(hook.result.current.data).toBe(before);
    });
});

describe('budget spending on a credit card', () => {
    it('adds it to the card and takes it back off when the entry is deleted', async () => {
        const hook = await openVault();
        await run(hook, f => f.addSpending({ budgetId: 'groc', amount: 84.2, date: '2026-10-06', note: 'Costco', cardId: 'visa' }));
        expect(balance(hook, 'visa')).toBe(1084.2);
        await run(hook, f => f.deleteSpending(f.spending[0].id));
        expect(balance(hook, 'visa')).toBe(1000);
    });

    it('leaves cards alone for cash spending', async () => {
        const hook = await openVault();
        await run(hook, f => f.addSpending({ budgetId: 'groc', amount: 30, date: '2026-10-06' }));
        await run(hook, f => f.deleteSpending(f.spending[0].id));
        expect(balance(hook, 'visa')).toBe(1000);
    });

    it('keeps card spending on the card as charges when its budget is deleted', async () => {
        const hook = await openVault();
        await run(hook, f => f.addSpending({ budgetId: 'groc', amount: 40, date: '2026-10-06', note: 'Costco', cardId: 'visa' }));
        await run(hook, f => f.addSpending({ budgetId: 'groc', amount: 10, date: '2026-10-07' }));
        await run(hook, f => f.deleteBudget('groc'));

        expect(hook.result.current.spending).toEqual([]);
        expect(balance(hook, 'visa')).toBe(1040);
        expect(hook.result.current.cardTransactions).toEqual([
            expect.objectContaining({ cardId: 'visa', type: 'charge', amount: 40, date: '2026-10-06', note: 'Groceries · Costco' }),
        ]);
        await run(hook, f => f.deleteCardTransaction(f.cardTransactions[0].id));
        expect(balance(hook, 'visa')).toBe(1000);
    });

    it('keeps spending in its budget when the card is deleted, dropping the card and its transactions', async () => {
        const hook = await openVault();
        await run(hook, f => f.addCardTransaction({ cardId: 'visa', type: 'charge', amount: 25, date: '2026-10-06' }));
        await run(hook, f => f.addCardTransaction({ cardId: 'car', type: 'payment', amount: 5, date: '2026-10-06' }));
        await run(hook, f => f.addSpending({ budgetId: 'groc', amount: 60, date: '2026-10-06', cardId: 'visa' }));
        await run(hook, f => f.deleteCard('visa'));

        expect(hook.result.current.cards.map(c => c.id)).toEqual(['car']);
        expect(hook.result.current.cardTransactions.map(t => t.cardId)).toEqual(['car']);
        expect(hook.result.current.spending).toHaveLength(1);
        expect(JSON.stringify(hook.result.current.spending[0])).not.toContain('cardId');

        await run(hook, f => f.deleteSpending(f.spending[0].id));
        expect(balance(hook, 'car')).toBe(4995);
    });
});

describe('scheduled payments', () => {
    it('lowers a card balance when marked paid, adjusts it when the amount changes, and restores it when unmarked', async () => {
        const hook = await openVault();
        const due = { kind: 'card' as const, itemId: 'visa', dueDate: '2026-10-25' };
        await run(hook, f => f.markPaid(due, 200, '2026-10-24'));
        expect(balance(hook, 'visa')).toBe(800);
        await run(hook, f => f.markPaid(due, 250, '2026-10-24'));
        expect(balance(hook, 'visa')).toBe(750);
        expect(hook.result.current.payments).toHaveLength(1);
        await run(hook, f => f.unmarkPaid(f.payments[0].id));
        expect(balance(hook, 'visa')).toBe(1000);
    });

    it('does not touch cards for bills', async () => {
        const hook = await openVault();
        await run(hook, f => f.markPaid({ kind: 'bill', itemId: 'rent', dueDate: '2026-10-15' }, 1200, '2026-10-14'));
        expect(balance(hook, 'visa')).toBe(1000);
    });
});

describe('actual pay', () => {
    it('records one amount per payday, updating it in place', async () => {
        const hook = await openVault();
        await run(hook, f => f.setIncomeActual('job', '2026-10-02', 1234.56));
        await run(hook, f => f.setIncomeActual('job', '2026-10-02', 1300));
        await run(hook, f => f.setIncomeActual('job', '2026-09-18', 900));
        const actuals = hook.result.current.incomeActuals;
        expect(actuals.map(a => [a.payDate, a.amount])).toEqual([['2026-10-02', 1300], ['2026-09-18', 900]]);

        await run(hook, f => f.deleteIncomeActual(actuals[1].id));
        expect(hook.result.current.incomeActuals.map(a => a.payDate)).toEqual(['2026-10-02']);
    });

    it('goes away with its income, along with the pay-period setting that pointed at it', async () => {
        const hook = await openVault();
        await run(hook, f => f.setIncomeActual('job', '2026-10-02', 1234.56));
        await run(hook, f => f.updateSettings(s => ({ ...s, payPeriodIncomeId: 'job' })));
        await run(hook, f => f.deleteIncome('job'));
        expect(hook.result.current.incomeActuals).toEqual([]);
        expect(hook.result.current.settings.payPeriodIncomeId).toBeUndefined();
    });
});

describe('importData', () => {
    it('drops records that point at cards or incomes missing from the file', async () => {
        const hook = await openVault({
            ...seed,
            incomeActuals: [
                { id: 'a1', incomeId: 'job', payDate: '2026-10-02', amount: 1100 },
                { id: 'a2', incomeId: 'gone', payDate: '2026-10-02', amount: 1 },
            ],
            cardTransactions: [
                { id: 't1', cardId: 'visa', type: 'payment', amount: 10, date: '2026-10-02' },
                { id: 't2', cardId: 'gone', type: 'payment', amount: 10, date: '2026-10-02' },
            ],
            spending: [
                { id: 's1', budgetId: 'groc', amount: 5, date: '2026-10-02', cardId: 'visa' },
                { id: 's2', budgetId: 'groc', amount: 5, date: '2026-10-02', cardId: 'gone' },
                { id: 's3', budgetId: 'gone', amount: 5, date: '2026-10-02' },
            ],
        });
        const f = hook.result.current;
        expect(f.incomeActuals.map(a => a.id)).toEqual(['a1']);
        expect(f.cardTransactions.map(t => t.id)).toEqual(['t1']);
        expect(f.spending.map(s => [s.id, s.cardId])).toEqual([['s1', 'visa'], ['s2', undefined]]);
        expect(balance(hook, 'visa')).toBe(1000); // balances are taken as-is, not replayed
        expect(showAlert).toHaveBeenLastCalledWith('Import Complete', expect.any(String));
    });

    it('keeps lists an older export does not have, if what they point at is still there', async () => {
        const hook = await openVault();
        await run(hook, f => f.setIncomeActual('job', '2026-10-02', 1100));
        await run(hook, f => f.addCardTransaction({ cardId: 'visa', type: 'charge', amount: 5, date: '2026-10-02' }));

        // A desktop-era export: bills and incomes only.
        await run(hook, f => f.importData(JSON.stringify({ bills: [], incomes: seed.incomes })));
        expect(hook.result.current.incomeActuals).toHaveLength(1);
        expect(hook.result.current.cardTransactions).toHaveLength(1);
        expect(hook.result.current.cards).toHaveLength(2);

        await run(hook, f => f.importData(JSON.stringify({ bills: [], incomes: [], cards: [] })));
        expect(hook.result.current.incomeActuals).toEqual([]);
        expect(hook.result.current.cardTransactions).toEqual([]);
    });

    it('rejects files that are not Billy data', async () => {
        const hook = await openVault();
        await run(hook, f => f.importData('not json'));
        expect(showAlert).toHaveBeenLastCalledWith('Import Failed', 'Could not parse JSON file.');
        await run(hook, f => f.importData(JSON.stringify({ hello: 'world' })));
        expect(showAlert).toHaveBeenLastCalledWith('Import Failed', 'Invalid data structure in JSON file.');
        expect(hook.result.current.cards).toHaveLength(2);
    });

    it('refuses to import into a vault that locked while the file picker was open', async () => {
        const hook = await openVault();
        await run(hook, f => f.lockVault());
        await run(hook, f => f.importData(JSON.stringify(normalizeVaultData({}))));
        expect(showAlert).toHaveBeenLastCalledWith('Import Cancelled', expect.any(String));
    });
});
