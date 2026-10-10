import { BudgetPeriod, PaymentFrequency, type Budget, type SpendingEntry } from '../../types';
import { budgetForDays, budgetMonthly, getBudgetStatus, getBudgetWindow } from '../budgets';
import { parseISODate, toISODate } from '../dates';

const d = parseISODate;
const today = d('2026-10-10'); // a Saturday

const budget = (overrides: Partial<Budget> = {}): Budget => ({
    id: 'groc', name: 'Groceries', amount: 600, period: BudgetPeriod.Monthly, isEssential: true, ...overrides,
});

describe('budgetMonthly', () => {
    it('converts weekly and per-pay-period budgets to a month', () => {
        expect(budgetMonthly(budget({ period: BudgetPeriod.Weekly, amount: 100 }))).toBeCloseTo(433.33);
        expect(budgetMonthly(budget({ period: BudgetPeriod.Monthly, amount: 500 }))).toBe(500);
        expect(budgetMonthly(budget({ period: BudgetPeriod.PayPeriod, amount: 200 }), PaymentFrequency.Biweekly)).toBeCloseTo(433.33);
    });

    it('treats a per-pay-period budget as monthly when there is no paycheck', () => {
        expect(budgetMonthly(budget({ period: BudgetPeriod.PayPeriod, amount: 200 }))).toBe(200);
    });
});

describe('budgetForDays', () => {
    it('prorates by the number of days, except per-pay-period budgets', () => {
        expect(budgetForDays(budget({ period: BudgetPeriod.Weekly, amount: 70 }), 14)).toBe(140);
        expect(budgetForDays(budget({ amount: 100 }), 365)).toBeCloseTo(1200);
        expect(budgetForDays(budget({ period: BudgetPeriod.PayPeriod, amount: 150 }), 9)).toBe(150);
    });
});

describe('getBudgetWindow', () => {
    const window = (b: Budget, payPeriod: { start: Date; end: Date } | null = null) => {
        const w = getBudgetWindow(b, today, payPeriod);
        return [toISODate(w.start), toISODate(w.end), w.label];
    };

    it('uses Monday–Sunday weeks and calendar months', () => {
        expect(window(budget({ period: BudgetPeriod.Weekly }))).toEqual(['2026-10-05', '2026-10-11', 'This week']);
        expect(window(budget())).toEqual(['2026-10-01', '2026-10-31', 'This month']);
    });

    it('follows the pay period, falling back to the month without a paycheck', () => {
        const payPeriod = { start: d('2026-10-02'), end: d('2026-10-15') };
        expect(window(budget({ period: BudgetPeriod.PayPeriod }), payPeriod)).toEqual(['2026-10-02', '2026-10-15', 'This pay period']);
        expect(window(budget({ period: BudgetPeriod.PayPeriod }))).toEqual(['2026-10-01', '2026-10-31', 'This month (no paycheck set up)']);
    });
});

describe('getBudgetStatus', () => {
    const spending: SpendingEntry[] = [
        { id: 'a', budgetId: 'groc', amount: 84.2, date: '2026-10-06' },
        { id: 'b', budgetId: 'groc', amount: 42.1, date: '2026-10-08', cardId: 'visa' },
        { id: 'c', budgetId: 'groc', amount: 999, date: '2026-09-30' },
        { id: 'd', budgetId: 'gas', amount: 51, date: '2026-10-07' },
    ];

    it("sums this window's spending for this budget, newest first", () => {
        const status = getBudgetStatus(budget(), spending, today, null);
        expect(status.entries.map(e => e.id)).toEqual(['b', 'a']);
        expect(status.spent).toBeCloseTo(126.3);
        expect(status.remaining).toBeCloseTo(473.7);
        expect(status.ratio).toBeCloseTo(126.3 / 600);
        expect(status.daysLeft).toBe(22);
    });

    it('goes negative when overspent', () => {
        const status = getBudgetStatus(budget({ amount: 100 }), spending, today, null);
        expect(status.remaining).toBeCloseTo(-26.3);
        expect(status.ratio).toBeGreaterThan(1);
    });

    it('handles a zero budget', () => {
        expect(getBudgetStatus(budget({ amount: 0 }), spending, today, null).ratio).toBe(Infinity);
        expect(getBudgetStatus(budget({ amount: 0 }), [], today, null).ratio).toBe(0);
    });
});
