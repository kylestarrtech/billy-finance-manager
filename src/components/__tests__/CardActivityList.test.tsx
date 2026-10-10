import { screen, userEvent } from '@testing-library/react-native';
import CardActivityList from '../CardActivityList';
import type { VaultData } from '../../context/FinanceContext';
import { renderInVault } from '../../test-utils/renderInVault';
import { dialogsMock, resetNativeMocks } from '../../test-utils/nativeMocks';

jest.mock('../../utils/storageAdapter', () => require('../../test-utils/nativeMocks').storageAdapterMock);
jest.mock('../../utils/biometrics', () => require('../../test-utils/nativeMocks').biometricsMock);
jest.mock('../../utils/notifications', () => require('../../test-utils/nativeMocks').notificationsMock);
jest.mock('../../utils/dialogs', () => require('../../test-utils/nativeMocks').dialogsMock);
jest.mock('expo-file-system', () => require('../../test-utils/nativeMocks').fileSystemMock);
jest.mock('expo-sharing', () => require('../../test-utils/nativeMocks').sharingMock);

const visa: VaultData['cards'][number] = { id: 'visa', kind: 'card', name: 'Visa', balance: 1000, apr: 20, plannedPayment: 200, dueDay: 25 };
const data: Partial<VaultData> = {
    cards: [visa],
    budgets: [{ id: 'groc', name: 'Groceries', amount: 500, period: 'monthly', isEssential: true }],
    cardTransactions: [
        { id: 't1', cardId: 'visa', type: 'payment', amount: 300, date: '2026-10-05', note: 'Bonus money' },
        { id: 't2', cardId: 'visa', type: 'charge', amount: 19.99, date: '2026-10-03', note: 'Netflix' },
    ],
    spending: [{ id: 's1', budgetId: 'groc', amount: 84.2, date: '2026-10-06', note: 'Costco', cardId: 'visa' }],
};

beforeEach(resetNativeMocks);

const show = (overrides: Partial<VaultData> = {}) => renderInVault(<CardActivityList card={visa} />, { ...data, ...overrides });

it('lists payments and charges newest first, payments as negative', async () => {
    await show();
    const rows = screen.getAllByRole('button', { name: /^Delete / }).map(r => r.props.accessibilityLabel);
    expect(rows).toEqual(['Delete Groceries · Costco', 'Delete Bonus money', 'Delete Netflix']);
    expect(screen.getByText('-$300.00')).toBeOnTheScreen();
    expect(screen.getByText('+$84.20')).toBeOnTheScreen();
    expect(screen.queryByText(/older/)).not.toBeOnTheScreen();
});

it('shows the five latest and counts the rest', async () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ id: `c${i}`, cardId: 'visa', type: 'charge' as const, amount: 1, date: `2026-09-0${i + 1}` }));
    await show({ cardTransactions: many, spending: [] });
    expect(screen.getAllByRole('button', { name: /^Delete / })).toHaveLength(5);
    expect(screen.getByText('+ 3 older')).toBeOnTheScreen();
});

it('deletes a payment after confirming, putting the balance back up', async () => {
    const { finance } = await show();
    await userEvent.setup().press(screen.getByRole('button', { name: 'Delete Bonus money' }));
    expect(dialogsMock.confirmAsync).toHaveBeenCalledWith(
        'Delete Entry',
        expect.stringMatching(/^Delete Bonus money \(\$300\.00\) from .*\? Visa's balance goes back up by that much\.$/),
        expect.objectContaining({ destructive: true })
    );
    expect(finance().cardTransactions.map(t => t.id)).toEqual(['t2']);
    expect(finance().cards[0].balance).toBe(1300);
});

it('deletes budget spending from both the card and the budget', async () => {
    const { finance } = await show();
    await userEvent.setup().press(screen.getByRole('button', { name: 'Delete Groceries · Costco' }));
    expect(dialogsMock.confirmAsync.mock.calls[0][1]).toMatch(/It comes off Visa's balance and its budget\.$/);
    expect(finance().spending).toEqual([]);
    expect(finance().cards[0].balance).toBeCloseTo(915.8);
});

it('keeps the entry when the delete is cancelled', async () => {
    dialogsMock.confirmAsync.mockImplementation(async () => false);
    const { finance } = await show();
    await userEvent.setup().press(screen.getByRole('button', { name: 'Delete Netflix' }));
    expect(finance().cardTransactions).toHaveLength(2);
    expect(finance().cards[0].balance).toBe(1000);
});

it('renders nothing without activity', async () => {
    await show({ cardTransactions: [], spending: [] });
    expect(screen.queryByText('Tap an entry to delete it.')).not.toBeOnTheScreen();
});
