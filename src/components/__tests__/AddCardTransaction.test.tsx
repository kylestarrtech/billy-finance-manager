import { screen, userEvent } from '@testing-library/react-native';
import AddCardTransaction from '../AddCardTransaction';
import type { VaultData } from '../../context/FinanceContext';
import { renderInVault } from '../../test-utils/renderInVault';
import { resetNativeMocks } from '../../test-utils/nativeMocks';

jest.mock('../../utils/storageAdapter', () => require('../../test-utils/nativeMocks').storageAdapterMock);
jest.mock('../../utils/biometrics', () => require('../../test-utils/nativeMocks').biometricsMock);
jest.mock('../../utils/notifications', () => require('../../test-utils/nativeMocks').notificationsMock);
jest.mock('../../utils/dialogs', () => require('../../test-utils/nativeMocks').dialogsMock);
jest.mock('expo-file-system', () => require('../../test-utils/nativeMocks').fileSystemMock);
jest.mock('expo-sharing', () => require('../../test-utils/nativeMocks').sharingMock);

const data: Partial<VaultData> = {
    cards: [
        { id: 'visa', kind: 'card', name: 'Visa', balance: 1000, apr: 20, plannedPayment: 200, dueDay: 25 },
        { id: 'paid', kind: 'card', name: 'Amex', balance: 0, apr: 20, plannedPayment: 100, dueDay: 25 },
        { id: 'car', kind: 'loan', name: 'Car Loan', balance: 5000, apr: 5, plannedPayment: 300, dueDay: 20 },
    ],
    budgets: [{ id: 'groc', name: 'Groceries', amount: 500, period: 'monthly', isEssential: true }],
};

beforeEach(resetNativeMocks);

const open = (cardId: string) => renderInVault(<AddCardTransaction cardId={cardId} onClose={jest.fn()} />, data);
const balance = (finance: () => { cards: VaultData['cards'] }, id: string) => finance().cards.find(c => c.id === id)!.balance;

it('records a payment on a card and lowers its balance', async () => {
    const { finance } = await open('visa');
    const user = userEvent.setup();
    expect(screen.getByText('Make a Payment')).toBeOnTheScreen();
    expect(screen.getByText('$1,000.00 owing')).toBeOnTheScreen();

    await user.type(screen.getByPlaceholderText('0.00'), '150');
    expect(screen.getByText('Lowers the balance to $850.00. Your regular monthly payment stays the same.')).toBeOnTheScreen();
    await user.type(screen.getByPlaceholderText('Bonus money'), 'Tax refund');
    await user.press(screen.getByRole('button', { name: 'Record Payment' }));

    expect(balance(finance, 'visa')).toBe(850);
    expect(finance().cardTransactions).toEqual([expect.objectContaining({ cardId: 'visa', type: 'payment', amount: 150, note: 'Tax refund' })]);
});

it('will not take a payment bigger than what is owing', async () => {
    const { finance } = await open('visa');
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('0.00'), '1000.01');
    expect(screen.queryByText(/Lowers the balance|Pays off/)).not.toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Record Payment' }));

    expect(screen.getByText("That's more than the $1,000.00 owing.")).toBeOnTheScreen();
    expect(balance(finance, 'visa')).toBe(1000);
    expect(finance().cardTransactions).toEqual([]);
});

it('pays a balance off exactly', async () => {
    const { finance } = await open('visa');
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('0.00'), '1000');
    expect(screen.getByText('Pays off the card.')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Record Payment' }));
    expect(balance(finance, 'visa')).toBe(0);
});

it('asks for an amount', async () => {
    const { finance } = await open('visa');
    await userEvent.setup().press(screen.getByRole('button', { name: 'Record Payment' }));
    expect(screen.getByText('Please enter an amount.')).toBeOnTheScreen();
    expect(finance().cardTransactions).toEqual([]);
});

it('adds a plain charge to a card', async () => {
    const { finance } = await open('visa');
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Charge' }));
    expect(screen.getByText('Add a Charge')).toBeOnTheScreen();
    await user.type(screen.getByPlaceholderText('0.00'), '64.99');
    expect(screen.getByText('Raises the balance to $1,064.99.')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Add Charge' }));

    expect(balance(finance, 'visa')).toBe(1064.99);
    expect(finance().cardTransactions).toEqual([expect.objectContaining({ type: 'charge', amount: 64.99 })]);
    expect(finance().spending).toEqual([]);
});

it('logs a charge tagged with a budget as that budget’s spending on the card', async () => {
    const { finance } = await open('visa');
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Charge' }));
    await user.type(screen.getByPlaceholderText('0.00'), '84.20');
    await user.press(screen.getByRole('button', { name: 'Groceries' }));
    expect(screen.getByText('Raises the balance to $1,084.20 and counts toward Groceries.')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Add Charge' }));

    expect(balance(finance, 'visa')).toBe(1084.2);
    expect(finance().spending).toEqual([expect.objectContaining({ budgetId: 'groc', amount: 84.2, cardId: 'visa' })]);
    expect(finance().cardTransactions).toEqual([]);
});

it('starts on a charge for a paid-off card', async () => {
    await open('paid');
    expect(screen.getByText('Add a Charge')).toBeOnTheScreen();
    expect(screen.getByText('Paid off')).toBeOnTheScreen();
});

it('only offers payments on a loan', async () => {
    const { finance } = await open('car');
    const user = userEvent.setup();
    expect(screen.getByText('Extra Payment')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Charge' })).not.toBeOnTheScreen();

    await user.type(screen.getByPlaceholderText('0.00'), '500');
    expect(screen.getByText('Lowers the balance to $4,500.00. Your regular monthly payment stays the same.')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Record Payment' }));
    expect(balance(finance, 'car')).toBe(4500);
});
