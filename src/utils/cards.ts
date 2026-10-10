import { isLoan, type Budget, type CardTransaction, type CreditCard, type SpendingEntry } from '../types';
import { addMonthsClamped, parseISODate, startOfToday } from './dates';
import { cardDueDates } from './schedule';

const MAX_MONTHS = 600;

export interface PayoffProjection {
    /** Payments until the balance hits zero; null when the planned payment never gets there. */
    months: number | null;
    totalInterest: number;
    payoffDate: Date | null;
    /** Interest the current balance accrues in one month. */
    monthlyInterest: number;
}

export function nextCardDueDate(card: Pick<CreditCard, 'dueDay'>, today: Date = startOfToday()): Date {
    const [next] = cardDueDates(card, today, addMonthsClamped(today, 2));
    return next;
}

/** Month-by-month simulation of paying `payment` against `balance` at `apr` (interest compounded monthly). */
export function projectPayoff(card: Pick<CreditCard, 'balance' | 'apr' | 'dueDay'>, payment: number, today: Date = startOfToday()): PayoffProjection {
    const rate = Math.max(0, card.apr) / 100 / 12;
    let balance = card.balance;
    const monthlyInterest = balance * rate;

    if (balance <= 0) return { months: 0, totalInterest: 0, payoffDate: today, monthlyInterest: 0 };
    if (payment <= monthlyInterest + 0.005) return { months: null, totalInterest: Infinity, payoffDate: null, monthlyInterest };

    let months = 0;
    let totalInterest = 0;
    while (balance > 0.005 && months < MAX_MONTHS) {
        const interest = balance * rate;
        totalInterest += interest;
        balance = balance + interest - payment;
        months++;
    }
    if (balance > 0.005) return { months: null, totalInterest: Infinity, payoffDate: null, monthlyInterest };

    const firstDue = nextCardDueDate(card, today);
    return { months, totalInterest, payoffDate: addMonthsClamped(firstDue, months - 1), monthlyInterest };
}

export const utilization = (card: CreditCard): number | null =>
    card.creditLimit && card.creditLimit > 0 ? card.balance / card.creditLimit : null;

/** Common credit-score guidance: keep utilization under 30%, ideally under 10%. */
export const UTILIZATION_GOAL = 0.3;
export const UTILIZATION_IDEAL = 0.1;

export type UtilizationBand = 'excellent' | 'good' | 'fair' | 'high';

export const utilizationBand = (ratio: number): UtilizationBand =>
    ratio < UTILIZATION_IDEAL ? 'excellent' : ratio < UTILIZATION_GOAL ? 'good' : ratio < 0.5 ? 'fair' : 'high';

/** How much to pay so `balance` is at most `target` of `limit`. */
const payDownTo = (balance: number, limit: number, target: number) => Math.max(0, balance - limit * target);

export interface CardUtilization {
    card: CreditCard;
    ratio: number;
    payToGoal: number;
}

export interface UtilizationSummary {
    totalBalance: number;
    totalLimit: number;
    ratio: number;
    /** Estimated ratio once this month's planned payments are made (interest not included). */
    afterPlannedRatio: number;
    payToGoal: number;
    payToIdeal: number;
    /** Every card with a credit limit, highest utilization first. */
    cards: CardUtilization[];
    /** Cards carrying a balance but no credit limit (e.g. financed purchases); not counted. */
    uncounted: CreditCard[];
}

/**
 * Overall revolving-credit utilization: balances over limits, across every card with a limit. Paid-off
 * cards still count, since their unused limit lowers the ratio. Returns null when no card has a limit.
 */
export function getUtilizationSummary(entries: CreditCard[]): UtilizationSummary | null {
    // Loans are installment debt; utilization only measures revolving credit.
    const cards = entries.filter(c => !isLoan(c));
    const withLimit = cards.filter(c => c.creditLimit && c.creditLimit > 0);
    if (withLimit.length === 0) return null;

    const sum = (values: number[]) => values.reduce((total, v) => total + v, 0);
    const totalLimit = sum(withLimit.map(c => c.creditLimit!));
    const totalBalance = sum(withLimit.map(c => Math.max(0, c.balance)));
    const afterPlanned = sum(withLimit.map(c => Math.max(0, c.balance - Math.min(c.plannedPayment, c.balance))));

    return {
        totalBalance,
        totalLimit,
        ratio: totalBalance / totalLimit,
        afterPlannedRatio: afterPlanned / totalLimit,
        payToGoal: payDownTo(totalBalance, totalLimit, UTILIZATION_GOAL),
        payToIdeal: payDownTo(totalBalance, totalLimit, UTILIZATION_IDEAL),
        cards: withLimit
            .map(card => ({
                card,
                ratio: Math.max(0, card.balance) / card.creditLimit!,
                payToGoal: payDownTo(Math.max(0, card.balance), card.creditLimit!, UTILIZATION_GOAL),
            }))
            .sort((a, b) => b.ratio - a.ratio),
        uncounted: cards.filter(c => !(c.creditLimit && c.creditLimit > 0) && c.balance > 0),
    };
}

export interface CardsSummary {
    totalBalance: number;
    totalPlanned: number;
    totalInterest: number;
    /** When every card is paid off at the planned payments; null if any card never gets there. */
    debtFreeDate: Date | null;
    neverPaidOff: CreditCard[];
    /** Highest-APR card with a balance: where extra money saves the most interest ("avalanche"). */
    focusCard: CreditCard | undefined;
}

export function getCardsSummary(cards: CreditCard[], today: Date = startOfToday()): CardsSummary {
    const withBalance = cards.filter(c => c.balance > 0);
    const projections = withBalance.map(card => ({ card, projection: projectPayoff(card, card.plannedPayment, today) }));
    const neverPaidOff = projections.filter(p => p.projection.months === null).map(p => p.card);
    const dates = projections.map(p => p.projection.payoffDate).filter((d): d is Date => d !== null);

    return {
        totalBalance: withBalance.reduce((sum, c) => sum + c.balance, 0),
        totalPlanned: withBalance.reduce((sum, c) => sum + c.plannedPayment, 0),
        totalInterest: projections.reduce((sum, p) => sum + p.projection.totalInterest, 0),
        debtFreeDate: neverPaidOff.length > 0 || dates.length === 0 ? null : new Date(Math.max(...dates.map(d => d.getTime()))),
        neverPaidOff,
        focusCard: [...withBalance].sort((a, b) => b.apr - a.apr)[0],
    };
}

export interface PromoCheck {
    promoEnd: Date;
    /** Payments due between now and the end of the promo (inclusive). */
    paymentsLeft: number;
    /** Even monthly payment that clears the balance by the promo end. */
    neededPayment: number;
    clearsInTime: boolean;
    /** The promo has already ended with a balance left. */
    expired: boolean;
}

/**
 * For loans with a promotional rate (e.g. "0% for 12 months", often with deferred interest that's charged
 * retroactively if anything is left at the end): will the planned payments clear it in time?
 */
export function checkPromo(loan: CreditCard, today: Date = startOfToday()): PromoCheck | null {
    if (!loan.promoEndDate || loan.balance <= 0) return null;
    const promoEnd = parseISODate(loan.promoEndDate);
    const paymentsLeft = promoEnd < today ? 0 : cardDueDates(loan, today, promoEnd).length;
    const neededPayment = paymentsLeft > 0 ? loan.balance / paymentsLeft : loan.balance;
    return {
        promoEnd,
        paymentsLeft,
        neededPayment,
        clearsInTime: paymentsLeft > 0 && loan.plannedPayment * paymentsLeft >= loan.balance - 0.005,
        expired: promoEnd < today,
    };
}

export interface CardActivity {
    id: string;
    /** 'spending' is budget spending put on the card; deleting it also removes it from the budget. */
    source: 'transaction' | 'spending';
    date: string;
    label: string;
    /** Positive raises the balance (charges), negative lowers it (payments). */
    amount: number;
}

/** One-off payments and charges on a card or loan, including budget spending put on it, newest first. */
export function getCardActivity(
    cardId: string,
    data: { cardTransactions: CardTransaction[]; spending: SpendingEntry[]; budgets: Budget[] }
): CardActivity[] {
    const transactions = data.cardTransactions
        .filter(t => t.cardId === cardId)
        .map((t): CardActivity => ({
            id: t.id,
            source: 'transaction',
            date: t.date,
            label: t.note || (t.type === 'payment' ? 'Payment' : 'Charge'),
            amount: t.type === 'payment' ? -t.amount : t.amount,
        }));
    const spending = data.spending
        .filter(e => e.cardId === cardId)
        .map((e): CardActivity => {
            const budget = data.budgets.find(b => b.id === e.budgetId)?.name ?? 'Budget';
            return { id: e.id, source: 'spending', date: e.date, label: e.note ? `${budget} · ${e.note}` : budget, amount: e.amount };
        });
    return [...transactions, ...spending].sort((a, b) => b.date.localeCompare(a.date));
}
