import { PaymentFrequency, isLoan, type Bill, type CreditCard, type Income, type Payment } from '../types';
import { addDays, addMonthsClamped, daysBetween, lastDayOfMonth, parseISODate, startOfToday, toISODate } from './dates';

// Single source of truth for "when does this happen": the calendar, upcoming list, pay period, reminders
// and paid-tracking all expand bills, card payments and paychecks into dated occurrences through here.

export const DAY_STEPS: Partial<Record<PaymentFrequency, number>> = {
    [PaymentFrequency.Daily]: 1,
    [PaymentFrequency.Weekly]: 7,
    [PaymentFrequency.Biweekly]: 14,
};

export const MONTH_STEPS: Partial<Record<PaymentFrequency, number>> = {
    [PaymentFrequency.Monthly]: 1,
    [PaymentFrequency.Bimonthly]: 2,
    [PaymentFrequency.Quarterly]: 3,
    [PaymentFrequency.Semiannually]: 6,
    [PaymentFrequency.Annually]: 12,
};

export const normalizeToMonthly = (amount: number, frequency: PaymentFrequency): number => {
    switch (frequency) {
        case PaymentFrequency.Daily:
            return (amount * 365) / 12;
        case PaymentFrequency.Weekly:
            return (amount * 52) / 12;
        case PaymentFrequency.Biweekly:
            return (amount * 26) / 12;
        case PaymentFrequency.Monthly:
            return amount;
        case PaymentFrequency.Bimonthly:
            return (amount * 6) / 12;
        case PaymentFrequency.Quarterly:
            return (amount * 4) / 12;
        case PaymentFrequency.Semiannually:
            return (amount * 2) / 12;
        case PaymentFrequency.Annually:
            return amount / 12;
        case PaymentFrequency.Onetime:
            return 0;
        default:
            return 0;
    }
};

/** Dates of a schedule starting on `start` that fall within [from, to] (inclusive), optionally ending on `end`. */
export function occurrencesInRange(start: Date, frequency: PaymentFrequency, from: Date, to: Date, end?: Date): Date[] {
    const last = end && end < to ? end : to;
    const result: Date[] = [];
    if (last < from) return result;

    if (frequency === PaymentFrequency.Onetime) {
        if (start >= from && start <= last) result.push(start);
        return result;
    }

    const dayStep = DAY_STEPS[frequency];
    const monthStep = MONTH_STEPS[frequency];

    if (dayStep) {
        let n = start < from ? Math.ceil(daysBetween(start, from) / dayStep) : 0;
        let date = addDays(start, n * dayStep);
        while (date <= last) {
            result.push(date);
            n++;
            date = addDays(start, n * dayStep);
        }
    } else if (monthStep) {
        let n = 0;
        if (start < from) {
            const monthsElapsed = (from.getFullYear() - start.getFullYear()) * 12 + (from.getMonth() - start.getMonth());
            n = Math.max(0, Math.floor(monthsElapsed / monthStep) - 1);
        }
        let date = addMonthsClamped(start, n * monthStep);
        while (date < from) {
            n++;
            date = addMonthsClamped(start, n * monthStep);
        }
        while (date <= last) {
            result.push(date);
            n++;
            date = addMonthsClamped(start, n * monthStep);
        }
    }
    return result;
}

/** A credit card's payment due dates (monthly on `dueDay`, clamped to short months) within [from, to]. */
export function cardDueDates(card: Pick<CreditCard, 'dueDay'>, from: Date, to: Date): Date[] {
    const result: Date[] = [];
    const day = Math.min(Math.max(Math.round(card.dueDay) || 1, 1), 31);
    for (let y = from.getFullYear(), m = from.getMonth(); y < to.getFullYear() || (y === to.getFullYear() && m <= to.getMonth()); m++) {
        if (m > 11) {
            m = 0;
            y++;
        }
        const date = new Date(y, m, Math.min(day, lastDayOfMonth(y, m)));
        if (date >= from && date <= to) result.push(date);
    }
    return result;
}

export const isIncomeActive = (income: Income, today: Date = startOfToday()): boolean =>
    !income.endingPaymentDate || parseISODate(income.endingPaymentDate) >= today;

/** One scheduled bill or credit-card payment, with its payment record if it has been marked paid. */
export interface DueItem {
    key: string;
    kind: 'bill' | 'card';
    itemId: string;
    name: string;
    /** Expected amount, or the amount actually paid once marked paid. */
    amount: number;
    date: Date;
    dueDate: string;
    isEssential: boolean;
    /** A loan / financing payment rather than a credit card payment (kind 'card' covers both). */
    isLoan?: boolean;
    payment?: Payment;
}

export interface IncomeItem {
    key: string;
    incomeId: string;
    name: string;
    amount: number;
    date: Date;
}

export const dueKey = (kind: Payment['kind'], itemId: string, dueDate: string) => `${kind}:${itemId}:${dueDate}`;

const byDateThenName = <T extends { date: Date; name: string }>(a: T, b: T) =>
    a.date.getTime() - b.date.getTime() || a.name.localeCompare(b.name);

/** Every bill and card payment due within [from, to] (inclusive). */
export function getDueItems(
    data: { bills: Bill[]; cards: CreditCard[]; payments: Payment[] },
    from: Date,
    to: Date,
    today: Date = startOfToday()
): DueItem[] {
    const paymentsByKey = new Map(data.payments.map(p => [dueKey(p.kind, p.itemId, p.dueDate), p]));
    const items: DueItem[] = [];

    for (const bill of data.bills) {
        for (const date of occurrencesInRange(parseISODate(bill.firstPaymentDate), bill.frequency, from, to)) {
            const dueDate = toISODate(date);
            const payment = paymentsByKey.get(dueKey('bill', bill.id, dueDate));
            items.push({
                key: dueKey('bill', bill.id, dueDate),
                kind: 'bill',
                itemId: bill.id,
                name: bill.name,
                amount: payment?.amount ?? bill.cost,
                date,
                dueDate,
                isEssential: bill.isEssential,
                payment,
            });
        }
    }

    for (const card of data.cards) {
        for (const date of cardDueDates(card, from, to)) {
            const dueDate = toISODate(date);
            const payment = paymentsByKey.get(dueKey('card', card.id, dueDate));
            // A paid-off card has nothing left to pay going forward.
            if (!payment && date >= today && card.balance <= 0) continue;
            const expected = card.balance > 0 ? Math.min(card.plannedPayment, card.balance) : card.plannedPayment;
            items.push({
                key: dueKey('card', card.id, dueDate),
                kind: 'card',
                itemId: card.id,
                name: card.name,
                amount: payment?.amount ?? expected,
                date,
                dueDate,
                isEssential: true,
                isLoan: isLoan(card),
                payment,
            });
        }
    }

    return items.sort(byDateThenName);
}

/** Every paycheck/income payment within [from, to] (inclusive), honouring income end dates. */
export function getIncomeItems(incomes: Income[], from: Date, to: Date): IncomeItem[] {
    const items: IncomeItem[] = [];
    for (const income of incomes) {
        const end = income.endingPaymentDate ? parseISODate(income.endingPaymentDate) : undefined;
        for (const date of occurrencesInRange(parseISODate(income.initialPaymentDate), income.frequency, from, to, end)) {
            items.push({ key: `income:${income.id}:${toISODate(date)}`, incomeId: income.id, name: income.name, amount: income.amount, date });
        }
    }
    return items.sort(byDateThenName);
}

/** How many days back an unpaid bill still counts as "overdue" rather than history from before tracking. */
export const OVERDUE_WINDOW_DAYS = 7;

/** Unpaid bills and card payments, most urgent first: recent overdue ones, then upcoming. */
export function getUpcomingDue(
    data: { bills: Bill[]; cards: CreditCard[]; payments: Payment[] },
    today: Date = startOfToday(),
    limit = 5
): DueItem[] {
    return getDueItems(data, addDays(today, -OVERDUE_WINDOW_DAYS), addDays(today, 400), today)
        .filter(item => !item.payment)
        .slice(0, limit);
}
