import { BudgetPeriod, type Budget, type PaymentFrequency, type SpendingEntry } from '../types';
import { addDays, daysBetween, endOfMonth, parseISODate, startOfMonth, startOfWeek } from './dates';
import { normalizeToMonthly } from './schedule';

export interface DateWindow {
    start: Date;
    /** Inclusive. */
    end: Date;
}

export const BUDGET_PERIOD_LABELS: Record<BudgetPeriod, string> = {
    [BudgetPeriod.Weekly]: 'Weekly',
    [BudgetPeriod.Monthly]: 'Monthly',
    [BudgetPeriod.PayPeriod]: 'Each pay period',
};

/** A budget's monthly equivalent, for totals. Pay-period budgets follow the paycheck's frequency. */
export function budgetMonthly(budget: Budget, paycheckFrequency?: PaymentFrequency): number {
    switch (budget.period) {
        case BudgetPeriod.Weekly:
            return (budget.amount * 52) / 12;
        case BudgetPeriod.PayPeriod:
            return paycheckFrequency ? normalizeToMonthly(budget.amount, paycheckFrequency) : budget.amount;
        case BudgetPeriod.Monthly:
        default:
            return budget.amount;
    }
}

/** How much of a budget falls within a span of `days` (used to set aside budgets in a pay period). */
export function budgetForDays(budget: Budget, days: number): number {
    switch (budget.period) {
        case BudgetPeriod.PayPeriod:
            return budget.amount;
        case BudgetPeriod.Weekly:
            return (budget.amount * days) / 7;
        case BudgetPeriod.Monthly:
        default:
            return (budget.amount * days * 12) / 365;
    }
}

/** The budget period containing `today`: Monday–Sunday, the calendar month, or the current pay period. */
export function getBudgetWindow(budget: Budget, today: Date, payPeriod: DateWindow | null): DateWindow & { label: string } {
    switch (budget.period) {
        case BudgetPeriod.Weekly: {
            const start = startOfWeek(today);
            return { start, end: addDays(start, 6), label: 'This week' };
        }
        case BudgetPeriod.PayPeriod:
            if (payPeriod) return { ...payPeriod, label: 'This pay period' };
            return { start: startOfMonth(today), end: endOfMonth(today), label: 'This month (no paycheck set up)' };
        case BudgetPeriod.Monthly:
        default:
            return { start: startOfMonth(today), end: endOfMonth(today), label: 'This month' };
    }
}

export interface BudgetStatus {
    window: DateWindow & { label: string };
    spent: number;
    remaining: number;
    /** spent / amount (can exceed 1). */
    ratio: number;
    daysLeft: number;
    /** Entries in the current window, newest first. */
    entries: SpendingEntry[];
}

export function getBudgetStatus(budget: Budget, spending: SpendingEntry[], today: Date, payPeriod: DateWindow | null): BudgetStatus {
    const window = getBudgetWindow(budget, today, payPeriod);
    const entries = spending
        .filter(e => {
            if (e.budgetId !== budget.id) return false;
            const date = parseISODate(e.date);
            return date >= window.start && date <= window.end;
        })
        .sort((a, b) => b.date.localeCompare(a.date));
    const spent = entries.reduce((sum, e) => sum + e.amount, 0);
    return {
        window,
        spent,
        remaining: budget.amount - spent,
        ratio: budget.amount > 0 ? spent / budget.amount : spent > 0 ? Infinity : 0,
        daysLeft: Math.max(0, daysBetween(today, window.end) + 1),
        entries,
    };
}
