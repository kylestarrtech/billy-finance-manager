import { fireEvent, screen, userEvent } from '@testing-library/react-native';
import Budgets from '../Budgets';
import CalendarView from '../CalendarView';
import Cards from '../Cards';
import Income from '../Income';
import Loans from '../Loans';
import PayPeriodCard from '../PayPeriodCard';
import type { VaultData } from '../../context/FinanceContext';
import { renderInVault } from '../../test-utils/renderInVault';
import { dialogsMock, resetNativeMocks } from '../../test-utils/nativeMocks';
import { pinToday } from '../../test-utils/pinToday';

jest.mock('../../utils/storageAdapter', () => require('../../test-utils/nativeMocks').storageAdapterMock);
jest.mock('../../utils/biometrics', () => require('../../test-utils/nativeMocks').biometricsMock);
jest.mock('../../utils/notifications', () => require('../../test-utils/nativeMocks').notificationsMock);
jest.mock('../../utils/dialogs', () => require('../../test-utils/nativeMocks').dialogsMock);
jest.mock('expo-file-system', () => require('../../test-utils/nativeMocks').fileSystemMock);
jest.mock('expo-sharing', () => require('../../test-utils/nativeMocks').sharingMock);

// Saturday Oct 10, 2026: pay period Oct 2 – Oct 15 for a job paid every other Friday.
beforeAll(() => pinToday('2026-10-10'));
afterAll(() => jest.useRealTimers());
beforeEach(resetNativeMocks);

const data: Partial<VaultData> = {
    incomes: [{ id: 'job', name: 'Warehouse Job', amount: 1400, frequency: 'biweekly', initialPaymentDate: '2026-09-04' }],
    incomeActuals: [{ id: 'a1', incomeId: 'job', payDate: '2026-10-02', amount: 1236.4 }],
    bills: [{ id: 'rent', name: 'Rent', cost: 1200, frequency: 'monthly', firstPaymentDate: '2026-01-15', isEssential: true }],
    cards: [
        { id: 'visa', kind: 'card', name: 'Visa', balance: 1850.25, apr: 21.99, creditLimit: 5000, plannedPayment: 250, dueDay: 25 },
        { id: 'car', kind: 'loan', name: 'Car Loan', balance: 8420, apr: 4.9, plannedPayment: 340, dueDay: 20, originalAmount: 15000 },
        { id: 'done', kind: 'loan', name: 'Phone', balance: 0, apr: 0, plannedPayment: 50, dueDay: 1 },
    ],
    cardTransactions: [
        { id: 't1', cardId: 'visa', type: 'payment', amount: 300, date: '2026-10-05', note: 'Bonus money' },
        { id: 't2', cardId: 'car', type: 'payment', amount: 200, date: '2026-10-04' },
    ],
    budgets: [{ id: 'groc', name: 'Groceries', amount: 600, period: 'monthly', isEssential: true }],
    spending: [{ id: 's1', budgetId: 'groc', amount: 84.2, date: '2026-10-06', note: 'Costco', cardId: 'visa' }],
};

describe('PayPeriodCard', () => {
    it('marks income as actual, lists extra debt payments, and opens the actual pay for this paycheck', async () => {
        const { editor } = await renderInVault(<PayPeriodCard />, data);
        expect(screen.getByText(/^Income\s+actual$/)).toBeOnTheScreen();
        expect(screen.getByText('+$1,236.40')).toBeOnTheScreen();
        expect(screen.getByText('Extra debt payments')).toBeOnTheScreen();
        expect(screen.getByText('-$500.00')).toBeOnTheScreen();

        await userEvent.setup().press(screen.getByRole('button', { name: 'Edit Actual Pay' }));
        expect(editor.openActualPaySheet).toHaveBeenCalledWith('job', '2026-10-02');
    });

    it('offers to enter actual pay when none has been, and hides the extra line without extra payments', async () => {
        await renderInVault(<PayPeriodCard />, { ...data, incomeActuals: [], cardTransactions: [] });
        expect(screen.getByText('+$1,400.00')).toBeOnTheScreen();
        expect(screen.getByRole('button', { name: 'Enter Actual Pay' })).toBeOnTheScreen();
        expect(screen.queryByText('Extra debt payments')).not.toBeOnTheScreen();
    });
});

describe('Cards', () => {
    it('has a Pay / Charge button next to the balance and lists the card’s activity', async () => {
        const { editor } = await renderInVault(<Cards />, data);
        expect(screen.getAllByText('$1,850.25')).toHaveLength(2); // payoff plan and the card
        expect(screen.getByRole('button', { name: 'Delete Groceries · Costco' })).toBeOnTheScreen();
        expect(screen.getByRole('button', { name: 'Delete Bonus money' })).toBeOnTheScreen();

        await userEvent.setup().press(screen.getByRole('button', { name: 'Pay / Charge' }));
        expect(editor.openCardTransactionEditor).toHaveBeenCalledWith('visa');
    });
});

describe('Loans', () => {
    it('offers extra payments only on loans with a balance', async () => {
        const { editor } = await renderInVault(<Loans />, data);
        expect(screen.getAllByRole('button', { name: 'Pay Extra' })).toHaveLength(1);
        expect(screen.getByRole('button', { name: 'Delete Payment' })).toBeOnTheScreen();

        await userEvent.setup().press(screen.getByRole('button', { name: 'Pay Extra' }));
        expect(editor.openCardTransactionEditor).toHaveBeenCalledWith('car');
    });
});

describe('Income', () => {
    it('shows the latest actual paycheck and opens the actual pay sheet', async () => {
        const { editor } = await renderInVault(<Income />, data);
        expect(screen.getByText('✓ Oct 2 paycheck: $1,236.40 actual')).toBeOnTheScreen();

        await userEvent.setup().press(screen.getByRole('button', { name: 'Actual Pay' }));
        expect(editor.openActualPaySheet).toHaveBeenCalledWith('job');
    });

    it('says nothing about actual pay until some is entered', async () => {
        await renderInVault(<Income />, { ...data, incomeActuals: [] });
        expect(screen.queryByText(/paycheck:/)).not.toBeOnTheScreen();
    });
});

describe('Budgets', () => {
    it('shows which card spending went on, and warns about it when deleting', async () => {
        await renderInVault(<Budgets />, data);
        expect(screen.getByText(' · Visa')).toBeOnTheScreen();

        const user = userEvent.setup();
        dialogsMock.confirmAsync.mockImplementation(async () => false);
        await user.press(screen.getByRole('button', { name: 'Delete Costco' }));
        expect(dialogsMock.confirmAsync.mock.calls[0][1]).toMatch(/It also comes off Visa's balance\.$/);

        dialogsMock.confirmAsync.mockClear();
        await user.press(screen.getByRole('button', { name: 'Delete' }));
        expect(dialogsMock.confirmAsync.mock.calls[0][1]).toContain('Spending put on a card stays on the card as a charge.');
    });
});

describe('CalendarView', () => {
    // Day cells are sized from the grid's measured width, so they only appear after a layout pass.
    const showCalendar = async () => {
        const result = await renderInVault(<CalendarView />, data);
        const [grid] = screen.container.queryAll(node => typeof node.props.onLayout === 'function');
        await fireEvent(grid, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 350, height: 300 } } });
        return result;
    };

    it('opens the actual pay sheet for the payday tapped', async () => {
        const { editor } = await showCalendar();
        const user = userEvent.setup();
        await user.press(screen.getByRole('button', { name: 'Friday, October 2' }));
        expect(screen.getByText('Actual pay · tap to change')).toBeOnTheScreen();
        await user.press(screen.getByRole('button', { name: 'Warehouse Job, income' }));
        expect(editor.openActualPaySheet).toHaveBeenCalledWith('job', '2026-10-02');

        await user.press(screen.getByRole('button', { name: 'Friday, October 16' }));
        expect(screen.getByText('Expected · tap to enter actual pay')).toBeOnTheScreen();
    });

    it('lists one-off card payments and card spending on their day', async () => {
        await showCalendar();
        const user = userEvent.setup();
        await user.press(screen.getByRole('button', { name: 'Monday, October 5' }));
        expect(screen.getByText('Visa · Bonus money')).toBeOnTheScreen();
        expect(screen.getByText('-$300.00')).toBeOnTheScreen();

        await user.press(screen.getByRole('button', { name: 'Tuesday, October 6' }));
        expect(screen.getByText('Groceries · Costco · Visa')).toBeOnTheScreen();
    });

    it('counts actual pay in the month’s income', async () => {
        await renderInVault(<CalendarView />, data);
        // Oct 2 (actual $1,236.40), Oct 16 and Oct 30 ($1,400 each).
        expect(screen.getByText('$4,036.40')).toBeOnTheScreen();
    });
});
