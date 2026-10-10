import type { CreditCard } from '../../types';
import {
    checkPromo,
    getCardActivity,
    getCardsSummary,
    getUtilizationSummary,
    nextCardDueDate,
    projectPayoff,
    utilization,
    utilizationBand,
} from '../cards';
import { parseISODate, toISODate } from '../dates';

const d = parseISODate;
const today = d('2026-10-10');

const card = (overrides: Partial<CreditCard> = {}): CreditCard => ({
    id: 'visa', kind: 'card', name: 'Visa', balance: 1000, apr: 12, plannedPayment: 100, dueDay: 25, ...overrides,
});

describe('nextCardDueDate', () => {
    it('is this month when the due day has not passed (today included), otherwise next month', () => {
        expect(toISODate(nextCardDueDate({ dueDay: 25 }, today))).toBe('2026-10-25');
        expect(toISODate(nextCardDueDate({ dueDay: 10 }, today))).toBe('2026-10-10');
        expect(toISODate(nextCardDueDate({ dueDay: 5 }, today))).toBe('2026-11-05');
    });
});

describe('projectPayoff', () => {
    it('is already done with no balance', () => {
        expect(projectPayoff(card({ balance: 0 }), 100, today)).toEqual({ months: 0, totalInterest: 0, payoffDate: today, monthlyInterest: 0 });
    });

    it('divides evenly at 0% APR', () => {
        const p = projectPayoff(card({ apr: 0 }), 100, today);
        expect(p.months).toBe(10);
        expect(p.totalInterest).toBe(0);
        expect(toISODate(p.payoffDate!)).toBe('2027-07-25');
    });

    it('matches the standard amortization with interest', () => {
        // $1,000 at 1% a month paying $100: ten full payments leave $58.40, which the 11th clears.
        const p = projectPayoff(card(), 100, today);
        expect(p.months).toBe(11);
        expect(p.monthlyInterest).toBeCloseTo(10);
        expect(p.totalInterest).toBeCloseTo(58.98, 1);
        expect(toISODate(p.payoffDate!)).toBe('2027-08-25');
    });

    it('never pays off when the payment does not beat the interest', () => {
        for (const payment of [5, 10]) {
            const p = projectPayoff(card(), payment, today);
            expect(p.months).toBeNull();
            expect(p.payoffDate).toBeNull();
            expect(p.totalInterest).toBe(Infinity);
        }
    });
});

describe('utilization', () => {
    it('is balance over limit, or null without a limit', () => {
        expect(utilization(card({ balance: 500, creditLimit: 2000 }))).toBe(0.25);
        expect(utilization(card({ creditLimit: undefined }))).toBeNull();
        expect(utilization(card({ creditLimit: 0 }))).toBeNull();
    });

    it.each([
        [0.05, 'excellent'], [0.1, 'good'], [0.29, 'good'], [0.3, 'fair'], [0.49, 'fair'], [0.5, 'high'],
    ] as const)('%f is %s', (ratio, band) => {
        expect(utilizationBand(ratio)).toBe(band);
    });
});

describe('getUtilizationSummary', () => {
    it('is null when no card has a limit', () => {
        expect(getUtilizationSummary([card({ creditLimit: undefined })])).toBeNull();
        expect(getUtilizationSummary([card({ kind: 'loan', creditLimit: 5000 })])).toBeNull();
    });

    it('totals cards with a limit, ignoring loans, and lists cards without one separately', () => {
        const summary = getUtilizationSummary([
            card({ id: 'a', balance: 1500, creditLimit: 2000, plannedPayment: 100 }),
            card({ id: 'b', balance: 0, creditLimit: 3000 }),
            card({ id: 'c', balance: 400, creditLimit: undefined }),
            card({ id: 'loan', kind: 'loan', balance: 5000, creditLimit: 10000 }),
        ])!;
        expect(summary.totalLimit).toBe(5000);
        expect(summary.totalBalance).toBe(1500);
        expect(summary.ratio).toBe(0.3);
        expect(summary.afterPlannedRatio).toBeCloseTo(0.28);
        expect(summary.payToGoal).toBeCloseTo(0);
        expect(summary.payToIdeal).toBeCloseTo(1000);
        expect(summary.cards.map(c => [c.card.id, c.ratio, c.payToGoal])).toEqual([['a', 0.75, 900], ['b', 0, 0]]);
        expect(summary.uncounted.map(c => c.id)).toEqual(['c']);
    });
});

describe('getCardsSummary', () => {
    it('flags balances the planned payment never clears and points extra money at the highest APR', () => {
        const summary = getCardsSummary([
            card({ id: 'a', balance: 1000, apr: 20, plannedPayment: 200 }),
            card({ id: 'b', balance: 500, apr: 25, plannedPayment: 5 }),
            card({ id: 'c', balance: 0, apr: 30 }),
        ], today);
        expect(summary.totalBalance).toBe(1500);
        expect(summary.totalPlanned).toBe(205);
        expect(summary.neverPaidOff.map(c => c.id)).toEqual(['b']);
        expect(summary.debtFreeDate).toBeNull();
        expect(summary.focusCard?.id).toBe('b');
    });

    it('is debt-free when the last card is paid off', () => {
        const summary = getCardsSummary([
            card({ id: 'a', apr: 0, balance: 300, plannedPayment: 100 }),
            card({ id: 'b', apr: 0, balance: 500, plannedPayment: 100 }),
        ], today);
        expect(toISODate(summary.debtFreeDate!)).toBe('2027-02-25');
        expect(summary.totalInterest).toBe(0);
    });
});

describe('checkPromo', () => {
    const loan = card({ kind: 'loan', apr: 0, balance: 1000, plannedPayment: 250, dueDay: 20, promoEndDate: '2027-01-31' });

    it('is null without a promo or a balance', () => {
        expect(checkPromo(card(), today)).toBeNull();
        expect(checkPromo({ ...loan, balance: 0 }, today)).toBeNull();
    });

    it('counts the payments left before the promo ends', () => {
        expect(checkPromo(loan, today)).toEqual({ promoEnd: d('2027-01-31'), paymentsLeft: 4, neededPayment: 250, clearsInTime: true, expired: false });
    });

    it('says what it would take when the plan falls short', () => {
        const promo = checkPromo({ ...loan, plannedPayment: 200 }, today)!;
        expect(promo.clearsInTime).toBe(false);
        expect(promo.neededPayment).toBe(250);
    });

    it('notices a promo that ended with a balance left', () => {
        expect(checkPromo({ ...loan, promoEndDate: '2026-09-30' }, today)).toMatchObject({ expired: true, paymentsLeft: 0, neededPayment: 1000, clearsInTime: false });
    });
});

describe('getCardActivity', () => {
    const budgets = [{ id: 'groc', name: 'Groceries', amount: 600, period: 'monthly' as const, isEssential: true }];

    it('merges one-off transactions with budget spending on the card, newest first, signed by effect on the balance', () => {
        const activity = getCardActivity('visa', {
            cardTransactions: [
                { id: 't1', cardId: 'visa', type: 'payment', amount: 150, date: '2026-10-05' },
                { id: 't2', cardId: 'visa', type: 'charge', amount: 20, date: '2026-10-07', note: 'Netflix' },
                { id: 't3', cardId: 'car', type: 'payment', amount: 50, date: '2026-10-08' },
            ],
            spending: [
                { id: 's1', budgetId: 'groc', amount: 84.2, date: '2026-10-06', note: 'Costco', cardId: 'visa' },
                { id: 's2', budgetId: 'groc', amount: 30, date: '2026-10-09' },
                { id: 's3', budgetId: 'gone', amount: 12, date: '2026-10-04', cardId: 'visa' },
            ],
            budgets,
        });
        expect(activity.map(a => [a.id, a.source, a.label, a.amount])).toEqual([
            ['t2', 'transaction', 'Netflix', 20],
            ['s1', 'spending', 'Groceries · Costco', 84.2],
            ['t1', 'transaction', 'Payment', -150],
            ['s3', 'spending', 'Budget', 12],
        ]);
    });

    it('labels an un-noted charge and is empty for a card with no activity', () => {
        const data = { cardTransactions: [{ id: 't', cardId: 'visa', type: 'charge' as const, amount: 5, date: '2026-10-01' }], spending: [], budgets };
        expect(getCardActivity('visa', data)[0].label).toBe('Charge');
        expect(getCardActivity('other', data)).toEqual([]);
    });
});
