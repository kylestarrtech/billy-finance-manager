import { PaymentFrequency, type Bill, type CreditCard, type Income, type Payment } from '../../types';
import { parseISODate, toISODate } from '../dates';
import {
    cardDueDates,
    dueKey,
    getDueItems,
    getIncomeItems,
    getUpcomingDue,
    isIncomeActive,
    normalizeToMonthly,
    occurrencesInRange,
    recentPaydays,
} from '../schedule';

const d = parseISODate;
const isoList = (dates: Date[]) => dates.map(toISODate);

const bill = (overrides: Partial<Bill> = {}): Bill => ({
    id: 'rent', name: 'Rent', cost: 1200, frequency: PaymentFrequency.Monthly, firstPaymentDate: '2026-01-15', isEssential: true, ...overrides,
});
const card = (overrides: Partial<CreditCard> = {}): CreditCard => ({
    id: 'visa', kind: 'card', name: 'Visa', balance: 1000, apr: 20, plannedPayment: 200, dueDay: 25, ...overrides,
});
const income = (overrides: Partial<Income> = {}): Income => ({
    id: 'job', name: 'Job', amount: 1400, frequency: PaymentFrequency.Biweekly, initialPaymentDate: '2026-09-04', ...overrides,
});

describe('normalizeToMonthly', () => {
    it.each([
        [PaymentFrequency.Daily, 365],
        [PaymentFrequency.Weekly, 52],
        [PaymentFrequency.Biweekly, 26],
        [PaymentFrequency.Monthly, 12],
        [PaymentFrequency.Bimonthly, 6],
        [PaymentFrequency.Quarterly, 4],
        [PaymentFrequency.Semiannually, 2],
        [PaymentFrequency.Annually, 1],
        [PaymentFrequency.Onetime, 0],
    ])('%s: $12 per payment', (frequency, expected) => {
        expect(normalizeToMonthly(12, frequency)).toBeCloseTo(expected);
    });
});

describe('occurrencesInRange', () => {
    it('includes both ends of the range', () => {
        expect(isoList(occurrencesInRange(d('2026-10-01'), PaymentFrequency.Weekly, d('2026-10-01'), d('2026-10-15')))).toEqual([
            '2026-10-01', '2026-10-08', '2026-10-15',
        ]);
    });

    it('lines up with the schedule when it started before the range', () => {
        expect(isoList(occurrencesInRange(d('2026-09-04'), PaymentFrequency.Biweekly, d('2026-10-03'), d('2026-11-01')))).toEqual([
            '2026-10-16', '2026-10-30',
        ]);
    });

    it('keeps monthly dates on the 31st where the month has one', () => {
        expect(isoList(occurrencesInRange(d('2026-01-31'), PaymentFrequency.Monthly, d('2026-01-01'), d('2026-05-31')))).toEqual([
            '2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31',
        ]);
    });

    it('steps quarterly and annually', () => {
        expect(isoList(occurrencesInRange(d('2026-01-15'), PaymentFrequency.Quarterly, d('2026-03-01'), d('2026-12-31')))).toEqual([
            '2026-04-15', '2026-07-15', '2026-10-15',
        ]);
        expect(isoList(occurrencesInRange(d('2024-02-29'), PaymentFrequency.Annually, d('2025-01-01'), d('2028-12-31')))).toEqual([
            '2025-02-28', '2026-02-28', '2027-02-28', '2028-02-29',
        ]);
    });

    it('returns a one-time payment only when it falls in the range', () => {
        expect(isoList(occurrencesInRange(d('2026-10-05'), PaymentFrequency.Onetime, d('2026-10-01'), d('2026-10-31')))).toEqual(['2026-10-05']);
        expect(occurrencesInRange(d('2026-09-05'), PaymentFrequency.Onetime, d('2026-10-01'), d('2026-10-31'))).toEqual([]);
    });

    it('stops at the end date', () => {
        expect(isoList(occurrencesInRange(d('2026-10-01'), PaymentFrequency.Weekly, d('2026-10-01'), d('2026-12-31'), d('2026-10-10')))).toEqual([
            '2026-10-01', '2026-10-08',
        ]);
    });

    it('is empty when the schedule starts after the range or ended before it', () => {
        expect(occurrencesInRange(d('2026-12-01'), PaymentFrequency.Weekly, d('2026-10-01'), d('2026-10-31'))).toEqual([]);
        expect(occurrencesInRange(d('2026-01-01'), PaymentFrequency.Weekly, d('2026-10-01'), d('2026-10-31'), d('2026-06-01'))).toEqual([]);
    });
});

describe('cardDueDates', () => {
    it('clamps the due day to short months', () => {
        expect(isoList(cardDueDates({ dueDay: 31 }, d('2026-01-01'), d('2026-04-30')))).toEqual([
            '2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30',
        ]);
    });

    it('rolls over into the next year', () => {
        expect(isoList(cardDueDates({ dueDay: 15 }, d('2026-11-20'), d('2027-02-01')))).toEqual(['2026-12-15', '2027-01-15']);
    });

    it('treats out-of-range due days as the nearest valid day', () => {
        expect(isoList(cardDueDates({ dueDay: 0 }, d('2026-10-01'), d('2026-10-31')))).toEqual(['2026-10-01']);
        expect(isoList(cardDueDates({ dueDay: 45 }, d('2026-10-01'), d('2026-10-31')))).toEqual(['2026-10-31']);
    });
});

describe('isIncomeActive', () => {
    it('is active without an end date or until the end date has passed', () => {
        const today = d('2026-10-10');
        expect(isIncomeActive(income(), today)).toBe(true);
        expect(isIncomeActive(income({ endingPaymentDate: '2026-10-10' }), today)).toBe(true);
        expect(isIncomeActive(income({ endingPaymentDate: '2026-10-09' }), today)).toBe(false);
    });
});

describe('getDueItems', () => {
    const today = d('2026-10-10');

    it('uses the paid amount once an occurrence is marked paid', () => {
        const payment: Payment = { id: 'p1', kind: 'bill', itemId: 'rent', dueDate: '2026-10-15', paidDate: '2026-10-14', amount: 1185.5 };
        const items = getDueItems({ bills: [bill()], cards: [], payments: [payment] }, d('2026-10-01'), d('2026-11-30'), today);
        expect(items.map(i => [i.dueDate, i.amount, i.payment?.id])).toEqual([
            ['2026-10-15', 1185.5, 'p1'],
            ['2026-11-15', 1200, undefined],
        ]);
        expect(items[0].key).toBe(dueKey('bill', 'rent', '2026-10-15'));
    });

    it('expects at most the remaining balance on a card', () => {
        const [item] = getDueItems({ bills: [], cards: [card({ balance: 80 })], payments: [] }, d('2026-10-01'), d('2026-10-31'), today);
        expect(item.amount).toBe(80);
        expect(item.isEssential).toBe(true);
    });

    it('drops upcoming payments on a paid-off card but keeps past ones that were paid', () => {
        const payment: Payment = { id: 'p1', kind: 'card', itemId: 'visa', dueDate: '2026-09-25', paidDate: '2026-09-25', amount: 200 };
        const items = getDueItems({ bills: [], cards: [card({ balance: 0 })], payments: [payment] }, d('2026-09-01'), d('2026-12-31'), today);
        expect(items.map(i => i.dueDate)).toEqual(['2026-09-25']);
    });

    it('flags loan payments', () => {
        const [item] = getDueItems({ bills: [], cards: [card({ kind: 'loan', name: 'Car' })], payments: [] }, d('2026-10-01'), d('2026-10-31'), today);
        expect(item.isLoan).toBe(true);
        expect(item.kind).toBe('card');
    });

    it('sorts by date, then name', () => {
        const items = getDueItems(
            { bills: [bill({ id: 'b', name: 'Water', firstPaymentDate: '2026-10-25' }), bill({ id: 'a', name: 'Internet', firstPaymentDate: '2026-10-25' })], cards: [card({ dueDay: 20 })], payments: [] },
            d('2026-10-01'),
            d('2026-10-31'),
            today
        );
        expect(items.map(i => i.name)).toEqual(['Visa', 'Internet', 'Water']);
    });
});

describe('getUpcomingDue', () => {
    it('lists unpaid items from the last week onwards, most urgent first, up to the limit', () => {
        const today = d('2026-10-10');
        const payments: Payment[] = [{ id: 'p', kind: 'bill', itemId: 'paid', dueDate: '2026-10-05', paidDate: '2026-10-05', amount: 10 }];
        const bills = [
            bill({ id: 'old', name: 'Too old', firstPaymentDate: '2026-10-02', frequency: PaymentFrequency.Onetime }),
            bill({ id: 'late', name: 'Overdue', firstPaymentDate: '2026-10-04', frequency: PaymentFrequency.Onetime }),
            bill({ id: 'paid', name: 'Paid', firstPaymentDate: '2026-10-05', frequency: PaymentFrequency.Onetime }),
            bill({ id: 'soon', name: 'Soon', firstPaymentDate: '2026-10-12', frequency: PaymentFrequency.Onetime }),
            bill({ id: 'later', name: 'Later', firstPaymentDate: '2026-11-12', frequency: PaymentFrequency.Onetime }),
        ];
        expect(getUpcomingDue({ bills, cards: [], payments }, today).map(i => i.name)).toEqual(['Overdue', 'Soon', 'Later']);
        expect(getUpcomingDue({ bills, cards: [], payments }, today, 2).map(i => i.name)).toEqual(['Overdue', 'Soon']);
    });
});

describe('getIncomeItems', () => {
    it('replaces the usual amount with the actual one for that payday only', () => {
        const items = getIncomeItems(
            {
                incomes: [income()],
                incomeActuals: [
                    { id: 'a1', incomeId: 'job', payDate: '2026-10-02', amount: 1236.4 },
                    { id: 'a2', incomeId: 'other', payDate: '2026-09-18', amount: 1 },
                ],
            },
            d('2026-09-01'),
            d('2026-10-31')
        );
        expect(items.map(i => [i.payDate, i.amount, i.actual?.id])).toEqual([
            ['2026-09-04', 1400, undefined],
            ['2026-09-18', 1400, undefined],
            ['2026-10-02', 1236.4, 'a1'],
            ['2026-10-16', 1400, undefined],
            ['2026-10-30', 1400, undefined],
        ]);
        expect(items[2].key).toBe('income:job:2026-10-02');
    });

    it('honours the end date', () => {
        const items = getIncomeItems({ incomes: [income({ endingPaymentDate: '2026-09-20' })], incomeActuals: [] }, d('2026-09-01'), d('2026-10-31'));
        expect(items.map(i => i.payDate)).toEqual(['2026-09-04', '2026-09-18']);
    });

    it('sorts several incomes by date, then name', () => {
        const items = getIncomeItems(
            { incomes: [income({ id: 'b', name: 'Side gig', frequency: PaymentFrequency.Monthly, initialPaymentDate: '2026-09-18' }), income()], incomeActuals: [] },
            d('2026-09-15'),
            d('2026-09-20')
        );
        expect(items.map(i => i.name)).toEqual(['Job', 'Side gig']);
    });
});

describe('recentPaydays', () => {
    const today = d('2026-10-10');

    it('lists the next payday, then the last four up to today, newest first', () => {
        expect(isoList(recentPaydays(income({ initialPaymentDate: '2025-09-05' }), today))).toEqual([
            '2026-10-16', '2026-10-02', '2026-09-18', '2026-09-04', '2026-08-21',
        ]);
    });

    it('counts a payday that is today as the current one, not the next', () => {
        expect(isoList(recentPaydays(income(), d('2026-10-02')))).toEqual(['2026-10-16', '2026-10-02', '2026-09-18', '2026-09-04']);
    });

    it('has no next payday once the income has ended', () => {
        expect(isoList(recentPaydays(income({ endingPaymentDate: '2026-09-20' }), today))).toEqual(['2026-09-18', '2026-09-04']);
    });

    it('offers just the first payday for an income that has not started', () => {
        expect(isoList(recentPaydays(income({ initialPaymentDate: '2026-11-06' }), today))).toEqual(['2026-11-06']);
    });
});
