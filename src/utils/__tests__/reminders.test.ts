import { PaymentFrequency, type Bill, type ReminderSettings } from '../../types';
import { buildReminderPlan } from '../reminders';

const now = new Date(2026, 9, 10, 8, 0); // Oct 10, 8:00 AM

const oneTime = (id: string, name: string, cost: number, date: string): Bill => ({
    id, name, cost, frequency: PaymentFrequency.Onetime, firstPaymentDate: date, isEssential: true,
});

const bills = [
    oneTime('water', 'Water', 30, '2026-10-11'),
    oneTime('rent', 'Rent', 900, '2026-10-15'),
    oneTime('phone', 'Phone', 65, '2026-10-15'),
    oneTime('late', 'Due today', 10, '2026-10-10'), // its reminder (yesterday 9 AM) has passed
    oneTime('paid', 'Paid', 10, '2026-10-20'),
    oneTime('far', 'Far off', 10, '2027-03-01'), // past the reminder horizon
];
const payments = [{ id: 'p', kind: 'bill' as const, itemId: 'paid', dueDate: '2026-10-20', paidDate: '2026-10-09', amount: 10 }];
const settings: ReminderSettings = { enabled: true, daysBefore: 1, hour: 9, minute: 0, showDetails: false };

const plan = (overrides: Partial<ReminderSettings> = {}) =>
    buildReminderPlan({ bills, cards: [], payments }, { ...settings, ...overrides }, now);

describe('buildReminderPlan', () => {
    it('sends one reminder per due date for unpaid bills, at the chosen time, soonest first', () => {
        expect(plan().map(r => r.date)).toEqual([new Date(2026, 9, 10, 9, 0), new Date(2026, 9, 14, 9, 0)]);
    });

    it('keeps names and amounts off the lock screen unless details are on', () => {
        expect(plan().map(r => [r.title, r.body])).toEqual([
            ['Bill reminder', 'A bill is due tomorrow. Open Billy for details.'],
            ['Bill reminder', '2 bills are due tomorrow. Open Billy for details.'],
        ]);
    });

    it('names the bills when details are on', () => {
        expect(plan({ showDetails: true }).map(r => [r.title, r.body])).toEqual([
            ['Water is due tomorrow', '$30.00'],
            ['2 bills are due tomorrow', 'Phone ($65.00), Rent ($900.00): $965.00 total'],
        ]);
    });

    it('words other lead times', () => {
        expect(plan({ daysBefore: 0, hour: 18 })[0]).toMatchObject({ date: new Date(2026, 9, 10, 18, 0), body: 'A bill is due today. Open Billy for details.' });
        expect(plan({ daysBefore: 3 }).map(r => r.body)).toEqual(['2 bills are due in 3 days. Open Billy for details.']);
    });

    it('includes card and loan payments', () => {
        const reminders = buildReminderPlan(
            { bills: [], cards: [{ id: 'visa', kind: 'card', name: 'Visa', balance: 500, apr: 20, plannedPayment: 100, dueDay: 25 }], payments: [] },
            { ...settings, showDetails: true },
            now
        );
        expect(reminders[0]).toMatchObject({ date: new Date(2026, 9, 24, 9, 0), title: 'Visa is due tomorrow', body: '$100.00' });
    });
});
