import { BudgetPeriod, PaymentFrequency, normalizeVaultData, type Bill } from '../../types';
import { parseISODate, toISODate } from '../dates';
import { getFrequencyBreakdown, getNextPaymentDetails, getSummaryStats } from '../financeHelpers';
import { pinToday } from '../../test-utils/pinToday';

const today = parseISODate('2026-10-10');

describe('getFrequencyBreakdown', () => {
    it('expresses an amount per day, week, month and year', () => {
        const b = getFrequencyBreakdown(1200, PaymentFrequency.Monthly);
        expect(b.monthly).toBe(1200);
        expect(b.annually).toBe(14400);
        expect(b.quarterly).toBe(3600);
        expect(b.semiannually).toBe(7200);
        expect(b.weekly).toBeCloseTo(14400 / 52);
        expect(b.biweekly).toBeCloseTo(14400 / 26);
        expect(b.daily).toBeCloseTo(14400 / 365);
    });
});

describe('getSummaryStats', () => {
    const stats = getSummaryStats(
        normalizeVaultData({
            incomes: [
                { id: 'job', name: 'Job', amount: 1400, frequency: PaymentFrequency.Biweekly, initialPaymentDate: '2026-09-04' },
                { id: 'old', name: 'Old', amount: 500, frequency: PaymentFrequency.Weekly, initialPaymentDate: '2026-01-02', endingPaymentDate: '2026-09-01' },
            ],
            bills: [
                { id: 'rent', name: 'Rent', cost: 1200, frequency: PaymentFrequency.Monthly, firstPaymentDate: '2026-01-15', isEssential: true },
                { id: 'tv', name: 'TV', cost: 20, frequency: PaymentFrequency.Monthly, firstPaymentDate: '2026-01-20', isEssential: false },
            ],
            budgets: [
                { id: 'groc', name: 'Groceries', amount: 600, period: BudgetPeriod.Monthly, isEssential: true },
                { id: 'fun', name: 'Fun', amount: 100, period: BudgetPeriod.PayPeriod, isEssential: false },
            ],
            cards: [
                { id: 'visa', kind: 'card', name: 'Visa', balance: 1000, apr: 20, plannedPayment: 200, dueDay: 25 },
                { id: 'paid', kind: 'card', name: 'Paid off', balance: 0, apr: 20, plannedPayment: 50, dueDay: 25 },
            ],
        }),
        today
    );

    it('only counts income that has not ended', () => {
        expect(stats.totalMonthlyIncome).toBeCloseTo(1400 * 26 / 12);
    });

    it('adds bills, budgets (pay-period ones at the paycheck frequency) and payments on cards with a balance', () => {
        expect(stats.billsMonthly).toBe(1220);
        expect(stats.budgetsMonthly).toBeCloseTo(600 + 100 * 26 / 12);
        expect(stats.cardsMonthly).toBe(200);
        expect(stats.totalMonthlyExpenses).toBeCloseTo(1220 + 600 + 100 * 26 / 12 + 200);
    });

    it('splits essential from non-essential spending (debt payments are neither)', () => {
        expect(stats.essentialExpenses).toBe(1800);
        expect(stats.nonEssentialExpenses).toBeCloseTo(20 + 100 * 26 / 12);
    });

    it('works out what is left', () => {
        expect(stats.leftoverCash).toBeCloseTo(stats.totalMonthlyIncome - stats.totalMonthlyExpenses);
        expect(stats.weeklyIncome).toBeCloseTo(1400 / 2);
    });
});

describe('getNextPaymentDetails', () => {
    // It always works from the real "today".
    beforeAll(() => pinToday('2026-10-10'));
    afterAll(() => jest.useRealTimers());

    const bill = (overrides: Partial<Bill>): Bill => ({
        id: 'b', name: 'Bill', cost: 10, frequency: PaymentFrequency.Monthly, firstPaymentDate: '2026-01-31', isEssential: true, ...overrides,
    });
    const next = (b: Bill) => {
        const details = getNextPaymentDetails(b);
        return [toISODate(details.nextDate), details.paymentsMade, details.isComplete];
    };

    it('is the first payment when that is still ahead', () => {
        expect(next(bill({ firstPaymentDate: '2026-12-01' }))).toEqual(['2026-12-01', 0, false]);
    });

    it('finds the next monthly date (clamped) and counts the ones before it', () => {
        expect(next(bill({}))).toEqual(['2026-10-31', 9, false]);
    });

    it('steps day-based schedules', () => {
        expect(next(bill({ frequency: PaymentFrequency.Weekly, firstPaymentDate: '2026-10-01' }))).toEqual(['2026-10-15', 2, false]);
    });

    it('is complete once a one-time payment has passed', () => {
        expect(next(bill({ frequency: PaymentFrequency.Onetime, firstPaymentDate: '2026-10-01' }))).toEqual(['2026-10-01', 1, true]);
    });
});
