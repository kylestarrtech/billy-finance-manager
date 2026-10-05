import { PaymentFrequency, isLoan, type CreditCard, type GoalContribution, type SavingsGoal, type VaultData } from '../types';
import { addDays, addMonthsClamped, parseISODate } from './dates';
import { getSummaryStats } from './financeHelpers';
import { getPayPeriodSummary, pickPaycheckIncome } from './payPeriod';
import { occurrencesInRange } from './schedule';

/**
 * Share of the monthly surplus Billy leaves unallocated as a cushion for surprises (car repairs, a high
 * utility bill...), so saving never eats the margin the budget depends on.
 */
export const SAVINGS_CUSHION = 0.2;
/** Card APR at or above which paying the card down beats saving (no savings account earns this). */
export const HIGH_INTEREST_APR = 10;

const PAYCHECKS_PER_YEAR: Record<PaymentFrequency, number> = {
    [PaymentFrequency.Daily]: 365,
    [PaymentFrequency.Weekly]: 52,
    [PaymentFrequency.Biweekly]: 26,
    [PaymentFrequency.Monthly]: 12,
    [PaymentFrequency.Bimonthly]: 6,
    [PaymentFrequency.Quarterly]: 4,
    [PaymentFrequency.Semiannually]: 2,
    [PaymentFrequency.Annually]: 1,
    [PaymentFrequency.Onetime]: 12,
};

const round2 = (n: number) => Math.round(n * 100) / 100;
const sum = (values: number[]) => values.reduce((total, v) => total + v, 0);

/** Price including sales tax. */
export const goalTotal = (goal: Pick<SavingsGoal, 'price' | 'taxRate'>): number =>
    round2(goal.price * (1 + (goal.taxRate ?? 0) / 100));

export const goalSaved = (goalId: string, contributions: GoalContribution[]): number =>
    round2(sum(contributions.filter(c => c.goalId === goalId).map(c => c.amount)));

export interface SavingsCapacity {
    monthlyIncome: number;
    /** Bills + budgets + card and loan payments, per month. */
    monthlyCommitted: number;
    monthlySurplus: number;
    cushion: number;
    /** What's safe to put toward goals each month. */
    safeMonthly: number;
    paycheckName?: string;
    paycheckFrequency?: PaymentFrequency;
    /** `safeMonthly` per paycheck (or per month when there's no recurring income). */
    perPaycheck: number;
    /** The current pay period, based on what's actually due before the next payday. */
    thisPeriod: {
        nextPayday: Date;
        /** Left after bills, debt payments, budgets and savings already logged this period. */
        free: number;
        alreadySaved: number;
        /** Suggested amount to set aside now: this paycheck's share, if this period can afford it. */
        suggested: number;
    } | null;
    /** Credit cards carrying a balance at a high APR, worth paying down before saving. */
    highInterestCards: CreditCard[];
}

/**
 * How much can safely go to savings: the monthly surplus after every commitment Billy knows about,
 * minus a cushion, spread across paychecks.
 */
export function getSavingsCapacity(data: VaultData, today: Date): SavingsCapacity {
    const stats = getSummaryStats(data, today);
    const monthlySurplus = Math.max(0, stats.leftoverCash);
    const cushion = monthlySurplus * SAVINGS_CUSHION;
    const safeMonthly = monthlySurplus - cushion;

    const paycheck = pickPaycheckIncome(data.incomes, data.settings.payPeriodIncomeId, today);
    const perPaycheck = (safeMonthly * 12) / (paycheck ? PAYCHECKS_PER_YEAR[paycheck.frequency] : 12);

    const period = getPayPeriodSummary(data, today);
    const thisPeriod = period
        ? {
            nextPayday: period.period.nextPayday,
            free: period.free,
            alreadySaved: period.savedTotal,
            suggested: round2(Math.max(0, Math.min(perPaycheck - period.savedTotal, period.free * (1 - SAVINGS_CUSHION)))),
        }
        : null;

    return {
        monthlyIncome: stats.totalMonthlyIncome,
        monthlyCommitted: stats.totalMonthlyExpenses,
        monthlySurplus,
        cushion,
        safeMonthly,
        paycheckName: paycheck?.name,
        paycheckFrequency: paycheck?.frequency,
        perPaycheck,
        thisPeriod,
        highInterestCards: data.cards.filter(c => !isLoan(c) && c.balance > 0 && c.apr >= HIGH_INTEREST_APR),
    };
}

export interface GoalPlan {
    goal: SavingsGoal;
    total: number;
    saved: number;
    remaining: number;
    /** 0–1 */
    progress: number;
    done: boolean;
    /** Amount Billy suggests putting toward this goal each paycheck. */
    perPaycheck: number;
    paychecksNeeded: number | null;
    /** When it'll be fully saved at `perPaycheck`; null if nothing can be set aside. */
    projectedDate: Date | null;
    target: {
        date: Date;
        paychecksLeft: number;
        /** Per paycheck needed to hit the target date. */
        neededPerPaycheck: number;
        onTrack: boolean;
    } | null;
}

/** The next `count` paydays after today (monthly from today if there's no recurring income). */
function upcomingPaydays(data: VaultData, today: Date, until: Date): Date[] {
    const paycheck = pickPaycheckIncome(data.incomes, data.settings.payPeriodIncomeId, today);
    if (!paycheck) {
        const dates: Date[] = [];
        for (let n = 1, d = addMonthsClamped(today, 1); d <= until; n++, d = addMonthsClamped(today, n)) dates.push(d);
        return dates;
    }
    const end = paycheck.endingPaymentDate ? parseISODate(paycheck.endingPaymentDate) : undefined;
    return occurrencesInRange(parseISODate(paycheck.initialPaymentDate), paycheck.frequency, addDays(today, 1), until, end);
}

/**
 * Splits the safe per-paycheck amount across goals: goals with a target date get what they need to hit
 * it first (in list order), then whatever is left is shared evenly by goals without a date.
 */
export function planGoals(data: VaultData, capacity: SavingsCapacity, today: Date): GoalPlan[] {
    const horizon = addDays(today, 365 * 10);
    const paydays = upcomingPaydays(data, today, horizon);

    const base = data.goals.map(goal => {
        const total = goalTotal(goal);
        const saved = goalSaved(goal.id, data.contributions);
        const remaining = round2(Math.max(0, total - saved));
        let target: GoalPlan['target'] = null;
        if (goal.targetDate) {
            const date = parseISODate(goal.targetDate);
            const paychecksLeft = paydays.filter(d => d <= date).length;
            target = { date, paychecksLeft, neededPerPaycheck: paychecksLeft > 0 ? remaining / paychecksLeft : remaining, onTrack: false };
        }
        return { goal, total, saved, remaining, done: remaining <= 0, target };
    });

    let pool = capacity.perPaycheck;
    const allocation = new Map<string, number>();
    for (const g of base) {
        if (g.done || !g.target) continue;
        const amount = Math.min(g.target.neededPerPaycheck, pool);
        allocation.set(g.goal.id, amount);
        pool -= amount;
    }
    const undated = base.filter(g => !g.done && !g.target);
    for (const g of undated) allocation.set(g.goal.id, pool / undated.length);

    return base.map(g => {
        const perPaycheck = round2(allocation.get(g.goal.id) ?? 0);
        const paychecksNeeded = g.done ? 0 : perPaycheck > 0 ? Math.ceil(g.remaining / perPaycheck - 1e-9) : null;
        const projectedDate = g.done ? today : paychecksNeeded ? paydays[paychecksNeeded - 1] ?? null : null;
        return {
            ...g,
            progress: g.total > 0 ? Math.min(1, g.saved / g.total) : 1,
            perPaycheck,
            paychecksNeeded,
            projectedDate,
            target: g.target && { ...g.target, onTrack: g.done || perPaycheck >= g.target.neededPerPaycheck - 0.005 },
        };
    });
}
