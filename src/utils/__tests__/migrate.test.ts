import { DEFAULT_SETTINGS, EMPTY_VAULT, PaymentFrequency, normalizeVaultData } from '../../types';
import { parseISODate } from '../dates';
import { loadVaultData } from '../migrate';

const today = parseISODate('2026-10-10');

describe('normalizeVaultData', () => {
    it('turns nothing into an empty vault', () => {
        expect(normalizeVaultData(null)).toEqual(EMPTY_VAULT);
        expect(normalizeVaultData(undefined)).toEqual(EMPTY_VAULT);
    });

    it('fills in lists missing from older vaults, including the newer ones', () => {
        const vault = normalizeVaultData({ bills: [], incomes: [] });
        expect(vault.incomeActuals).toEqual([]);
        expect(vault.cardTransactions).toEqual([]);
        expect(vault.goals).toEqual([]);
        expect(vault.settings).toEqual(DEFAULT_SETTINGS);
    });

    it('replaces lists that are not arrays', () => {
        expect(normalizeVaultData({ cards: 'nope' } as never).cards).toEqual([]);
    });

    it('merges partial settings with the defaults', () => {
        const vault = normalizeVaultData({ settings: { payPeriodIncomeId: 'job', reminders: { enabled: true } } } as never);
        expect(vault.settings.payPeriodIncomeId).toBe('job');
        expect(vault.settings.reminders).toEqual({ ...DEFAULT_SETTINGS.reminders, enabled: true });
    });
});

describe('loadVaultData', () => {
    it('leaves current data alone', () => {
        const bills = [{ id: 'rent', name: 'Rent', cost: 1200, frequency: PaymentFrequency.Monthly, firstPaymentDate: '2026-01-15', isEssential: true }];
        expect(loadVaultData({ bills }, today).bills).toEqual(bills);
    });

    it('moves monthly financed bills to loans, keeping their id and payment history', () => {
        const vault = loadVaultData(
            {
                bills: [
                    { id: 'tv', name: 'TV', cost: 300, frequency: 'monthly', firstPaymentDate: '2026-01-10', isEssential: false, isFinanced: true, totalLoanAmount: 3600, loanTermMonths: 12 },
                    { id: 'gym', name: 'Gym', cost: 40, frequency: 'monthly', firstPaymentDate: '2026-01-10', isEssential: false, isFinanced: false },
                    { id: 'odd', name: 'Weekly plan', cost: 25, frequency: 'weekly', firstPaymentDate: '2026-01-10', isEssential: false, isFinanced: true, totalLoanAmount: 500 },
                ],
                payments: [
                    { id: 'p1', kind: 'bill', itemId: 'tv', dueDate: '2026-09-10', paidDate: '2026-09-10', amount: 300 },
                    { id: 'p2', kind: 'bill', itemId: 'gym', dueDate: '2026-09-10', paidDate: '2026-09-10', amount: 40 },
                ],
            },
            today
        );

        // Jan 10 – Sep 10 have passed: nine payments of $300 off $3,600.
        expect(vault.cards).toEqual([
            { id: 'tv', kind: 'loan', name: 'TV', balance: 900, apr: 0, plannedPayment: 300, dueDay: 10, originalAmount: 3600 },
        ]);
        expect(vault.bills.map(b => b.id)).toEqual(['gym', 'odd']);
        for (const b of vault.bills) {
            expect(b).not.toHaveProperty('isFinanced');
            expect(b).not.toHaveProperty('totalLoanAmount');
            expect(b).not.toHaveProperty('loanTermMonths');
        }
        expect(vault.payments.map(p => [p.itemId, p.kind])).toEqual([['tv', 'card'], ['gym', 'bill']]);
    });
});
