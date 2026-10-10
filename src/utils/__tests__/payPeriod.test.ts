import { BudgetPeriod, PaymentFrequency, normalizeVaultData, type Income } from '../../types';
import { parseISODate, toISODate } from '../dates';
import { getPayPeriod, getPayPeriodSummary, pickPaycheckIncome } from '../payPeriod';

const d = parseISODate;
const today = d('2026-10-10');

const job: Income = { id: 'job', name: 'Job', amount: 1400, frequency: PaymentFrequency.Biweekly, initialPaymentDate: '2026-09-04' };

describe('pickPaycheckIncome', () => {
    const side: Income = { id: 'side', name: 'Side gig', amount: 500, frequency: PaymentFrequency.Monthly, initialPaymentDate: '2026-09-01' };
    const bonus: Income = { id: 'bonus', name: 'Bonus', amount: 9000, frequency: PaymentFrequency.Onetime, initialPaymentDate: '2026-10-01' };
    const oldJob: Income = { id: 'old', name: 'Old job', amount: 2000, frequency: PaymentFrequency.Weekly, initialPaymentDate: '2026-01-02', endingPaymentDate: '2026-09-01' };
    const incomes = [side, bonus, oldJob, job];

    it('uses the chosen income', () => {
        expect(pickPaycheckIncome(incomes, 'side', today)?.id).toBe('side');
    });

    it('otherwise uses the largest recurring income that is still active', () => {
        expect(pickPaycheckIncome(incomes, undefined, today)?.id).toBe('job');
    });

    it('ignores a chosen income that has ended or is one-time', () => {
        expect(pickPaycheckIncome(incomes, 'old', today)?.id).toBe('job');
        expect(pickPaycheckIncome(incomes, 'bonus', today)?.id).toBe('job');
    });

    it('is undefined without recurring income', () => {
        expect(pickPaycheckIncome([bonus], undefined, today)).toBeUndefined();
    });
});

describe('getPayPeriod', () => {
    it('runs from the last payday to the day before the next one', () => {
        const period = getPayPeriod([job], undefined, today)!;
        expect(toISODate(period.start)).toBe('2026-10-02');
        expect(toISODate(period.end)).toBe('2026-10-15');
        expect(toISODate(period.nextPayday)).toBe('2026-10-16');
        expect(period.days).toBe(14);
        expect(period.dayNumber).toBe(9);
    });

    it('starts a new period on payday', () => {
        const period = getPayPeriod([job], undefined, d('2026-10-16'))!;
        expect(toISODate(period.start)).toBe('2026-10-16');
        expect(period.dayNumber).toBe(1);
    });

    it('is null without a next payday', () => {
        expect(getPayPeriod([], undefined, today)).toBeNull();
        expect(getPayPeriod([{ ...job, endingPaymentDate: '2026-10-12' }], undefined, today)).toBeNull();
    });
});

describe('getPayPeriodSummary', () => {
    // Pay period Oct 2 – Oct 15 (14 days).
    const vault = normalizeVaultData({
        incomes: [job, { id: 'gig', name: 'Gig', amount: 300, frequency: PaymentFrequency.Onetime, initialPaymentDate: '2026-10-08' }],
        incomeActuals: [{ id: 'a', incomeId: 'job', payDate: '2026-10-02', amount: 1236.4 }],
        bills: [
            { id: 'rent', name: 'Rent', cost: 1200, frequency: PaymentFrequency.Monthly, firstPaymentDate: '2026-01-15', isEssential: true },
            { id: 'phone', name: 'Phone', cost: 65, frequency: PaymentFrequency.Monthly, firstPaymentDate: '2026-01-12', isEssential: true },
            { id: 'tv', name: 'TV', cost: 20, frequency: PaymentFrequency.Monthly, firstPaymentDate: '2026-01-20', isEssential: false },
        ],
        cards: [
            { id: 'visa', kind: 'card', name: 'Visa', balance: 1000, apr: 20, plannedPayment: 200, dueDay: 25 },
            { id: 'car', kind: 'loan', name: 'Car', balance: 8420, apr: 5, plannedPayment: 340, dueDay: 12 },
        ],
        budgets: [
            { id: 'groc', name: 'Groceries', amount: 600, period: BudgetPeriod.Monthly, isEssential: true },
            { id: 'gas', name: 'Gas', amount: 50, period: BudgetPeriod.Weekly, isEssential: true },
            { id: 'fun', name: 'Fun', amount: 150, period: BudgetPeriod.PayPeriod, isEssential: false },
        ],
        contributions: [
            { id: 'c1', goalId: 'g', amount: 100, date: '2026-10-03' },
            { id: 'c2', goalId: 'g', amount: 50, date: '2026-09-30' },
            { id: 'c3', goalId: 'g', amount: -20, date: '2026-10-09' },
        ],
        cardTransactions: [
            { id: 't1', cardId: 'visa', type: 'payment', amount: 150, date: '2026-10-05' },
            { id: 't2', cardId: 'visa', type: 'charge', amount: 75, date: '2026-10-06' },
            { id: 't3', cardId: 'car', type: 'payment', amount: 200, date: '2026-10-15' },
            { id: 't4', cardId: 'visa', type: 'payment', amount: 999, date: '2026-10-01' },
        ],
    });
    const summary = getPayPeriodSummary(vault, today)!;

    it('counts actual pay where it was entered, and every income paid in the period', () => {
        expect(summary.incomeItems.map(i => [i.name, i.amount])).toEqual([['Job', 1236.4], ['Gig', 300]]);
        expect(summary.incomeTotal).toBeCloseTo(1536.4);
    });

    it('sets aside bills and debt payments due in the period', () => {
        expect(summary.billsTotal).toBe(1265);
        expect(summary.cardsTotal).toBe(340);
    });

    it('prorates budgets to the length of the period', () => {
        expect(summary.budgetLines.map(l => [l.budget.id, l.amount])).toEqual([
            ['groc', expect.closeTo((600 * 14 * 12) / 365, 6)],
            ['gas', 100],
            ['fun', 150],
        ]);
    });

    it('subtracts one-off debt payments (not charges) made in the period, end date included', () => {
        expect(summary.extraPaymentsTotal).toBe(350);
    });

    it('subtracts what was saved toward goals in the period, net of withdrawals', () => {
        expect(summary.savedTotal).toBe(80);
    });

    it('works out what is left, overall and per day', () => {
        const free = 1536.4 - 1265 - 340 - summary.budgetsTotal - 350 - 80;
        expect(summary.free).toBeCloseTo(free);
        expect(summary.perDay).toBeCloseTo(free / 14);
    });

    it('is null without a pay period', () => {
        expect(getPayPeriodSummary(normalizeVaultData({}), today)).toBeNull();
    });
});
