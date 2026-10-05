import { type Bill, type VaultData } from '../types';
import { budgetMonthly } from './budgets';
import { addMonthsClamped, daysBetween, parseISODate, startOfToday } from './dates';
import { pickPaycheckIncome } from './payPeriod';
import { DAY_STEPS, MONTH_STEPS, isIncomeActive, normalizeToMonthly } from './schedule';

export { normalizeToMonthly } from './schedule';

export const getFrequencyBreakdown = (amount: number, frequency: Bill['frequency']) => {
    const monthly = normalizeToMonthly(amount, frequency);
    const yearly = monthly * 12;
    return {
        daily: yearly / 365,
        weekly: yearly / 52,
        biweekly: yearly / 26,
        monthly: monthly,
        quarterly: yearly / 4,
        semiannually: yearly / 2,
        annually: yearly
    };
};

export const getSummaryStats = (data: Pick<VaultData, 'bills' | 'incomes' | 'budgets' | 'cards' | 'settings'>, today: Date = startOfToday()) => {
    const sum = (values: number[]) => values.reduce((total, v) => total + v, 0);

    // Income that has already ended no longer counts toward the monthly picture.
    const totalMonthlyIncome = sum(
        data.incomes.filter(income => isIncomeActive(income, today)).map(income => normalizeToMonthly(income.amount, income.frequency))
    );

    const billsMonthly = sum(data.bills.map(bill => normalizeToMonthly(bill.cost, bill.frequency)));
    const essentialBills = sum(data.bills.filter(bill => bill.isEssential).map(bill => normalizeToMonthly(bill.cost, bill.frequency)));

    const paycheckFrequency = pickPaycheckIncome(data.incomes, data.settings.payPeriodIncomeId, today)?.frequency;
    const budgetsMonthly = sum(data.budgets.map(budget => budgetMonthly(budget, paycheckFrequency)));
    const essentialBudgets = sum(data.budgets.filter(b => b.isEssential).map(budget => budgetMonthly(budget, paycheckFrequency)));

    const cardsMonthly = sum(data.cards.filter(card => card.balance > 0).map(card => card.plannedPayment));

    const totalMonthlyExpenses = billsMonthly + budgetsMonthly + cardsMonthly;
    const essentialExpenses = essentialBills + essentialBudgets;
    const nonEssentialExpenses = (billsMonthly - essentialBills) + (budgetsMonthly - essentialBudgets);

    const leftoverCash = totalMonthlyIncome - totalMonthlyExpenses;

    // Enhanced Stats Breakdown
    const dailyIncome = (totalMonthlyIncome * 12) / 365;
    const weeklyIncome = (totalMonthlyIncome * 12) / 52;
    const dailyExpenses = (totalMonthlyExpenses * 12) / 365;
    const weeklyExpenses = (totalMonthlyExpenses * 12) / 52;

    return {
        totalMonthlyIncome,
        totalMonthlyExpenses,
        billsMonthly,
        budgetsMonthly,
        cardsMonthly,
        essentialExpenses,
        nonEssentialExpenses,
        leftoverCash,
        dailyIncome,
        weeklyIncome,
        dailyExpenses,
        weeklyExpenses
    }
};

export const getNextPaymentDetails = (bill: Bill) => {
    const today = startOfToday();
    const firstDate = parseISODate(bill.firstPaymentDate);

    let nextDate = firstDate;
    let paymentsMade = 0;
    // true once a one-time payment is in the past and nothing else is due
    let isComplete = false;

    if (firstDate < today) {
        const dayStep = DAY_STEPS[bill.frequency];
        const monthStep = MONTH_STEPS[bill.frequency];

        if (dayStep) {
            paymentsMade = Math.ceil(daysBetween(firstDate, today) / dayStep);
            nextDate = new Date(firstDate.getFullYear(), firstDate.getMonth(), firstDate.getDate() + paymentsMade * dayStep);
        } else if (monthStep) {
            const monthsElapsed = (today.getFullYear() - firstDate.getFullYear()) * 12 + (today.getMonth() - firstDate.getMonth());
            paymentsMade = Math.max(0, Math.floor(monthsElapsed / monthStep));
            nextDate = addMonthsClamped(firstDate, paymentsMade * monthStep);
            while (nextDate < today) {
                paymentsMade++;
                nextDate = addMonthsClamped(firstDate, paymentsMade * monthStep);
            }
        } else {
            // One-time payment already happened.
            paymentsMade = 1;
            isComplete = true;
        }
    }

    return { nextDate, paymentsMade, isComplete };
};
