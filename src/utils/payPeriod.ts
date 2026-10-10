import { PaymentFrequency, type Budget, type Income, type VaultData } from '../types';
import { budgetForDays } from './budgets';
import { addDays, daysBetween, parseISODate } from './dates';
import { getDueItems, getIncomeItems, isIncomeActive, normalizeToMonthly, occurrencesInRange, type DueItem, type IncomeItem } from './schedule';

/** The income whose paydays define the pay period: the chosen one, or else the largest recurring income. */
export function pickPaycheckIncome(incomes: Income[], preferredId: string | undefined, today: Date): Income | undefined {
    const recurring = incomes.filter(i => i.frequency !== PaymentFrequency.Onetime && isIncomeActive(i, today));
    const preferred = recurring.find(i => i.id === preferredId);
    if (preferred) return preferred;
    return [...recurring].sort((a, b) => normalizeToMonthly(b.amount, b.frequency) - normalizeToMonthly(a.amount, a.frequency))[0];
}

export interface PayPeriod {
    income: Income;
    /** The most recent payday (on or before today). */
    start: Date;
    /** The day before the next payday. */
    end: Date;
    nextPayday: Date;
    days: number;
    /** 1-based: which day of the period today is. */
    dayNumber: number;
}

export function getPayPeriod(incomes: Income[], preferredId: string | undefined, today: Date): PayPeriod | null {
    const income = pickPaycheckIncome(incomes, preferredId, today);
    if (!income) return null;
    const start = parseISODate(income.initialPaymentDate);
    const ending = income.endingPaymentDate ? parseISODate(income.endingPaymentDate) : undefined;

    const previous = occurrencesInRange(start, income.frequency, addDays(today, -400), today, ending);
    const next = occurrencesInRange(start, income.frequency, addDays(today, 1), addDays(today, 400), ending);
    if (previous.length === 0 || next.length === 0) return null;

    const periodStart = previous[previous.length - 1];
    const nextPayday = next[0];
    return {
        income,
        start: periodStart,
        end: addDays(nextPayday, -1),
        nextPayday,
        days: daysBetween(periodStart, nextPayday),
        dayNumber: daysBetween(periodStart, today) + 1,
    };
}

export interface PayPeriodSummary {
    period: PayPeriod;
    incomeItems: IncomeItem[];
    incomeTotal: number;
    dueItems: DueItem[];
    billsTotal: number;
    cardsTotal: number;
    budgetLines: { budget: Budget; amount: number }[];
    budgetsTotal: number;
    /** One-off card and loan payments made during this pay period, on top of the scheduled ones. */
    extraPaymentsTotal: number;
    /** Put toward savings goals during this pay period. */
    savedTotal: number;
    /** What's left after bills, card payments and budgets. */
    free: number;
    perDay: number;
}

/** Money in vs. money already spoken for, between the last payday and the next one. */
export function getPayPeriodSummary(data: VaultData, today: Date): PayPeriodSummary | null {
    const period = getPayPeriod(data.incomes, data.settings.payPeriodIncomeId, today);
    if (!period) return null;

    const incomeItems = getIncomeItems(data, period.start, period.end);
    const dueItems = getDueItems(data, period.start, period.end, today);
    const budgetLines = data.budgets.map(budget => ({ budget, amount: budgetForDays(budget, period.days) }));

    const sum = (values: number[]) => values.reduce((total, v) => total + v, 0);
    const inPeriod = (isoDate: string) => {
        const date = parseISODate(isoDate);
        return date >= period.start && date <= period.end;
    };
    const incomeTotal = sum(incomeItems.map(i => i.amount));
    const billsTotal = sum(dueItems.filter(d => d.kind === 'bill').map(d => d.amount));
    const cardsTotal = sum(dueItems.filter(d => d.kind === 'card').map(d => d.amount));
    const budgetsTotal = sum(budgetLines.map(l => l.amount));
    const extraPaymentsTotal = sum(data.cardTransactions.filter(t => t.type === 'payment' && inPeriod(t.date)).map(t => t.amount));
    const savedTotal = sum(data.contributions.filter(c => inPeriod(c.date)).map(c => c.amount));
    const free = incomeTotal - billsTotal - cardsTotal - budgetsTotal - extraPaymentsTotal - savedTotal;

    return {
        period,
        incomeItems,
        incomeTotal,
        dueItems,
        billsTotal,
        cardsTotal,
        budgetLines,
        budgetsTotal,
        extraPaymentsTotal,
        savedTotal,
        free,
        perDay: period.days > 0 ? free / period.days : free,
    };
}
