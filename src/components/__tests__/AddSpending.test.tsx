import { screen, userEvent } from '@testing-library/react-native';
import AddSpending from '../AddSpending';
import type { VaultData } from '../../context/FinanceContext';
import { renderInVault } from '../../test-utils/renderInVault';
import { resetNativeMocks } from '../../test-utils/nativeMocks';

jest.mock('../../utils/storageAdapter', () => require('../../test-utils/nativeMocks').storageAdapterMock);
jest.mock('../../utils/biometrics', () => require('../../test-utils/nativeMocks').biometricsMock);
jest.mock('../../utils/notifications', () => require('../../test-utils/nativeMocks').notificationsMock);
jest.mock('../../utils/dialogs', () => require('../../test-utils/nativeMocks').dialogsMock);
jest.mock('expo-file-system', () => require('../../test-utils/nativeMocks').fileSystemMock);
jest.mock('expo-sharing', () => require('../../test-utils/nativeMocks').sharingMock);

const budgets: VaultData['budgets'] = [
    { id: 'groc', name: 'Groceries', amount: 500, period: 'monthly', isEssential: true },
    { id: 'gas', name: 'Gas', amount: 200, period: 'monthly', isEssential: true },
];
const cards: VaultData['cards'] = [
    { id: 'visa', kind: 'card', name: 'Visa', balance: 1000, apr: 20, plannedPayment: 200, dueDay: 25 },
    { id: 'car', kind: 'loan', name: 'Car Loan', balance: 5000, apr: 5, plannedPayment: 300, dueDay: 20 },
];

beforeEach(resetNativeMocks);

it('logs cash spending by default, leaving cards alone', async () => {
    const { finance } = await renderInVault(<AddSpending budgetId="gas" onClose={jest.fn()} />, { budgets, cards });
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('0.00'), '51');
    await user.press(screen.getByRole('button', { name: 'Log Spending' }));

    expect(finance().spending).toEqual([expect.objectContaining({ budgetId: 'gas', amount: 51 })]);
    expect(finance().spending[0]).not.toHaveProperty('cardId');
    expect(finance().cards.find(c => c.id === 'visa')!.balance).toBe(1000);
});

it('puts spending on a credit card, adding it to the balance', async () => {
    const { finance } = await renderInVault(<AddSpending onClose={jest.fn()} />, { budgets, cards });
    const user = userEvent.setup();
    expect(screen.getByRole('button', { name: 'Cash / Debit' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Car Loan' })).not.toBeOnTheScreen();

    await user.type(screen.getByPlaceholderText('0.00'), '84.20');
    await user.press(screen.getByRole('button', { name: 'Visa' }));
    expect(screen.getByText("Also adds it to Visa's balance.")).toBeOnTheScreen();
    await user.type(screen.getByPlaceholderText('Costco'), 'Costco');
    await user.press(screen.getByRole('button', { name: 'Log Spending' }));

    expect(finance().spending).toEqual([expect.objectContaining({ budgetId: 'groc', amount: 84.2, note: 'Costco', cardId: 'visa' })]);
    expect(finance().cards.find(c => c.id === 'visa')!.balance).toBe(1084.2);
});

it('does not ask how it was paid when there are no credit cards', async () => {
    await renderInVault(<AddSpending onClose={jest.fn()} />, { budgets, cards: [cards[1]] });
    expect(screen.queryByText('Paid With')).not.toBeOnTheScreen();
});
