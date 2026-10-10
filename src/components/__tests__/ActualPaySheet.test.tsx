import { screen, userEvent } from '@testing-library/react-native';
import ActualPaySheet from '../ActualPaySheet';
import type { VaultData } from '../../context/FinanceContext';
import { renderInVault } from '../../test-utils/renderInVault';
import { resetNativeMocks } from '../../test-utils/nativeMocks';
import { pinToday } from '../../test-utils/pinToday';

jest.mock('../../utils/storageAdapter', () => require('../../test-utils/nativeMocks').storageAdapterMock);
jest.mock('../../utils/biometrics', () => require('../../test-utils/nativeMocks').biometricsMock);
jest.mock('../../utils/notifications', () => require('../../test-utils/nativeMocks').notificationsMock);
jest.mock('../../utils/dialogs', () => require('../../test-utils/nativeMocks').dialogsMock);
jest.mock('expo-file-system', () => require('../../test-utils/nativeMocks').fileSystemMock);
jest.mock('expo-sharing', () => require('../../test-utils/nativeMocks').sharingMock);

// Paid every other Friday: Sep 4, Sep 18, Oct 2 (the latest), then Oct 16.
const data: Partial<VaultData> = {
    incomes: [
        { id: 'job', name: 'Warehouse Job', amount: 1400, frequency: 'biweekly', initialPaymentDate: '2026-02-20' },
        { id: 'old', name: 'Old Job', amount: 900, frequency: 'monthly', initialPaymentDate: '2024-01-01', endingPaymentDate: '2024-06-01' },
    ],
    incomeActuals: [{ id: 'a1', incomeId: 'job', payDate: '2026-10-02', amount: 1236.4 }],
};

beforeAll(() => pinToday('2026-10-10'));
afterAll(() => jest.useRealTimers());
beforeEach(resetNativeMocks);

const open = (incomeId = 'job', payDate?: string) =>
    renderInVault(<ActualPaySheet incomeId={incomeId} payDate={payDate} onClose={jest.fn()} />, data);

it('opens on the latest paycheck, showing what was entered for it', async () => {
    await open();
    expect(screen.getByText('Usually $1,400.00 / biweekly')).toBeOnTheScreen();
    expect(screen.getAllByRole('button', { name: /^(Oct|Sep)/ }).map(b => b.props.accessibilityLabel)).toEqual(['Oct 16', 'Oct 2 ✓', 'Sep 18', 'Sep 4']);
    expect(screen.getByDisplayValue('1236.40')).toBeOnTheScreen();
    expect(screen.getByText('Replaces the usual $1,400.00 for the Oct 2 paycheck only.')).toBeOnTheScreen();
});

it('updates the amount for that paycheck', async () => {
    const { finance } = await open();
    const user = userEvent.setup();
    await user.clear(screen.getByDisplayValue('1236.40'));
    await user.type(screen.getByPlaceholderText('1400.00'), '1250');
    await user.press(screen.getByRole('button', { name: 'Save' }));
    expect(finance().incomeActuals).toEqual([expect.objectContaining({ id: 'a1', payDate: '2026-10-02', amount: 1250 })]);
});

it('records a different paycheck, including an upcoming one', async () => {
    const { finance } = await open();
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Oct 16' }));
    expect(screen.queryByDisplayValue('1236.40')).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeOnTheScreen();

    await user.type(screen.getByPlaceholderText('1400.00'), '1588.75');
    await user.press(screen.getByRole('button', { name: 'Save' }));
    expect(finance().incomeActuals.map(a => [a.payDate, a.amount])).toEqual([['2026-10-02', 1236.4], ['2026-10-16', 1588.75]]);
});

it('accepts a paycheck of zero but not a blank one', async () => {
    const { finance } = await open();
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Sep 18' }));
    await user.press(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Please enter what you were paid.')).toBeOnTheScreen();

    await user.type(screen.getByPlaceholderText('1400.00'), '0');
    await user.press(screen.getByRole('button', { name: 'Save' }));
    expect(finance().incomeActuals.find(a => a.payDate === '2026-09-18')?.amount).toBe(0);
});

it('goes back to the usual amount', async () => {
    const { finance } = await open();
    await userEvent.setup().press(screen.getByRole('button', { name: 'Remove' }));
    expect(finance().incomeActuals).toEqual([]);
});

it('offers an older payday picked on the calendar', async () => {
    await open('job', '2026-06-12');
    expect(screen.getAllByRole('button', { name: /^(Oct|Sep|Jun)/ }).map(b => b.props.accessibilityLabel)).toEqual(['Oct 16', 'Oct 2 ✓', 'Sep 18', 'Sep 4', 'Jun 12']);
    expect(screen.getByText('Replaces the usual $1,400.00 for the Jun 12 paycheck only.')).toBeOnTheScreen();
});

it('explains when an income has no paychecks to correct', async () => {
    await open('old');
    expect(screen.getByText('There are no recent or upcoming paydays for this income.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeOnTheScreen();
});
