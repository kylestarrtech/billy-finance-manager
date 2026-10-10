import { BudgetPeriod, PaymentFrequency, normalizeVaultData, type SavingsGoal } from '../../types';
import { parseISODate, toISODate } from '../dates';
import { SAVINGS_CUSHION, getSavingsCapacity, goalSaved, goalTotal, planGoals, type SavingsCapacity } from '../goals';

const d = parseISODate;
const today = d('2026-10-10');

describe('goalTotal / goalSaved', () => {
    it('adds sales tax, rounded to the cent', () => {
        expect(goalTotal({ price: 999.99, taxRate: 13 })).toBe(1129.99);
        expect(goalTotal({ price: 250 })).toBe(250);
    });

    it("sums only this goal's contributions, net of withdrawals", () => {
        const contributions = [
            { id: '1', goalId: 'g', amount: 100.1, date: '2026-10-01' },
            { id: '2', goalId: 'g', amount: 0.2, date: '2026-10-02' },
            { id: '3', goalId: 'g', amount: -20, date: '2026-10-03' },
            { id: '4', goalId: 'other', amount: 500, date: '2026-10-03' },
        ];
        expect(goalSaved('g', contributions)).toBe(80.3);
    });
});

describe('getSavingsCapacity', () => {
    // Monthly pay, so the pay period is the calendar month (31 days in October).
    const vault = normalizeVaultData({
        incomes: [{ id: 'job', name: 'Job', amount: 4000, frequency: PaymentFrequency.Monthly, initialPaymentDate: '2026-09-01' }],
        bills: [{ id: 'rent', name: 'Rent', cost: 1000, frequency: PaymentFrequency.Monthly, firstPaymentDate: '2026-01-05', isEssential: true }],
        budgets: [{ id: 'groc', name: 'Groceries', amount: 500, period: BudgetPeriod.Monthly, isEssential: true }],
        cards: [
            { id: 'high', kind: 'card', name: 'High', balance: 1000, apr: 20, plannedPayment: 200, dueDay: 15 },
            { id: 'low', kind: 'card', name: 'Low', balance: 100, apr: 5, plannedPayment: 50, dueDay: 15 },
            { id: 'loan', kind: 'loan', name: 'Loan', balance: 5000, apr: 18, plannedPayment: 300, dueDay: 15 },
        ],
    });
    const capacity = getSavingsCapacity(vault, today);

    it('keeps a cushion out of the monthly surplus', () => {
        expect(capacity.monthlyIncome).toBe(4000);
        expect(capacity.monthlyCommitted).toBe(1000 + 500 + 200 + 50 + 300);
        expect(capacity.monthlySurplus).toBe(1950);
        expect(capacity.cushion).toBeCloseTo(1950 * SAVINGS_CUSHION);
        expect(capacity.safeMonthly).toBeCloseTo(1560);
        expect(capacity.perPaycheck).toBeCloseTo(1560);
        expect(capacity.paycheckFrequency).toBe(PaymentFrequency.Monthly);
    });

    it("suggests this paycheck's share, capped by what this pay period can spare", () => {
        const free = 4000 - 1000 - 550 - (500 * 31 * 12) / 365;
        expect(capacity.thisPeriod!.free).toBeCloseTo(free);
        expect(capacity.thisPeriod!.suggested).toBeCloseTo(Math.min(1560, free * (1 - SAVINGS_CUSHION)), 2);
    });

    it('only flags credit cards with a high APR as worth paying down first', () => {
        expect(capacity.highInterestCards.map(c => c.id)).toEqual(['high']);
    });

    it('spreads the monthly amount across paychecks', () => {
        const biweekly = getSavingsCapacity({ ...vault, incomes: [{ ...vault.incomes[0], frequency: PaymentFrequency.Biweekly, amount: 4000 * 12 / 26 }] }, today);
        expect(biweekly.perPaycheck).toBeCloseTo((biweekly.safeMonthly * 12) / 26);
    });

    it('has nothing to save when commitments use up the income', () => {
        const tight = getSavingsCapacity({ ...vault, bills: [{ ...vault.bills[0], cost: 5000 }] }, today);
        expect(tight.monthlySurplus).toBe(0);
        expect(tight.perPaycheck).toBe(0);
    });
});

describe('planGoals', () => {
    // Biweekly paydays after Oct 10: Oct 16, Oct 30, Nov 13, Nov 27, Dec 11, Dec 25, Jan 8, Jan 22...
    const vault = normalizeVaultData({
        incomes: [{ id: 'job', name: 'Job', amount: 1400, frequency: PaymentFrequency.Biweekly, initialPaymentDate: '2026-09-04' }],
        goals: [
            { id: 'trip', name: 'Trip', price: 1000, targetDate: '2026-12-31' },
            { id: 'tv', name: 'TV', price: 500 },
            { id: 'bike', name: 'Bike', price: 1000 },
            { id: 'done', name: 'Done', price: 100 },
        ] satisfies SavingsGoal[],
        contributions: [{ id: 'c', goalId: 'done', amount: 100, date: '2026-10-01' }],
    });
    const withCapacity = (perPaycheck: number) => ({ perPaycheck } as SavingsCapacity);

    it('funds dated goals first, then splits the rest across undated ones', () => {
        const plans = planGoals(vault, withCapacity(300), today);
        const byId = Object.fromEntries(plans.map(p => [p.goal.id, p]));

        expect(byId.trip.target).toMatchObject({ paychecksLeft: 6, onTrack: true });
        expect(byId.trip.perPaycheck).toBe(166.67);
        expect(byId.trip.paychecksNeeded).toBe(6);
        expect(toISODate(byId.trip.projectedDate!)).toBe('2026-12-25');

        expect(byId.tv.perPaycheck).toBe(66.67);
        expect(byId.tv.paychecksNeeded).toBe(8);
        expect(toISODate(byId.tv.projectedDate!)).toBe('2027-01-22');
        expect(byId.bike.perPaycheck).toBe(66.67);
    });

    it('marks fully saved goals done', () => {
        const done = planGoals(vault, withCapacity(300), today).find(p => p.goal.id === 'done')!;
        expect(done).toMatchObject({ done: true, progress: 1, remaining: 0, perPaycheck: 0, paychecksNeeded: 0 });
        expect(done.projectedDate).toBe(today);
    });

    it('reports a dated goal off track and leaves nothing for the rest when money is short', () => {
        const plans = planGoals(vault, withCapacity(100), today);
        const byId = Object.fromEntries(plans.map(p => [p.goal.id, p]));
        expect(byId.trip.perPaycheck).toBe(100);
        expect(byId.trip.target?.onTrack).toBe(false);
        expect(byId.tv.perPaycheck).toBe(0);
        expect(byId.tv.projectedDate).toBeNull();
    });
});
