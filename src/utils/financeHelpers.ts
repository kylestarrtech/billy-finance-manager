import { type Bill, type Income, PaymentFrequency } from '../context/FinanceContext';
import { parseISODate, startOfToday } from './dates';

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

export const getFrequencyBreakdown = (amount: number, frequency: PaymentFrequency) => {
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

export const getSummaryStats = (bills: Bill[], incomes: Income[]) => {

    const totalMonthlyIncome = incomes.reduce((total, income) => {
        return total + normalizeToMonthly(income.amount, income.frequency);
    }, 0);

    const totalMonthlyExpenses = bills.reduce((total, bill) => {
        return total + normalizeToMonthly(bill.cost, bill.frequency);
    }, 0);

    const essentialExpenses =
        bills.filter((bill) => bill.isEssential).reduce((total, bill) => {
            return total + normalizeToMonthly(bill.cost, bill.frequency);
        }, 0);

    const leftoverCash = totalMonthlyIncome - totalMonthlyExpenses;

    // Enhanced Stats Breakdown
    const dailyIncome = (totalMonthlyIncome * 12) / 365;
    const weeklyIncome = (totalMonthlyIncome * 12) / 52;
    const dailyExpenses = (totalMonthlyExpenses * 12) / 365;
    const weeklyExpenses = (totalMonthlyExpenses * 12) / 52;

    return {
        totalMonthlyIncome,
        totalMonthlyExpenses,
        essentialExpenses,
        leftoverCash,
        dailyIncome,
        weeklyIncome,
        dailyExpenses,
        weeklyExpenses
    }
};

const DAY_STEPS: Partial<Record<PaymentFrequency, number>> = {
    [PaymentFrequency.Daily]: 1,
    [PaymentFrequency.Weekly]: 7,
    [PaymentFrequency.Biweekly]: 14,
};

const MONTH_STEPS: Partial<Record<PaymentFrequency, number>> = {
    [PaymentFrequency.Monthly]: 1,
    [PaymentFrequency.Bimonthly]: 2,
    [PaymentFrequency.Quarterly]: 3,
    [PaymentFrequency.Semiannually]: 6,
    [PaymentFrequency.Annually]: 12,
};

// Whole calendar days between two local dates, immune to DST shifts.
const daysBetween = (from: Date, to: Date) =>
    Math.round(
        (Date.UTC(to.getFullYear(), to.getMonth(), to.getDate()) -
            Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())) / 86_400_000
    );

// Adds months while clamping to the end of shorter months, so a bill due on the 31st stays
// "end of month" instead of drifting (Jan 31 -> Feb 28 -> Mar 31, not Jan 31 -> Mar 3 -> Apr 3).
const addMonthsClamped = (date: Date, months: number) => {
    const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
    const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    target.setDate(Math.min(date.getDate(), lastDay));
    return target;
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

    let paymentsLeft = 0;
    let remainingBalance = 0;
    if (bill.isFinanced && bill.totalLoanAmount) {
        remainingBalance = Math.max(0, bill.totalLoanAmount - (bill.cost * paymentsMade));
        paymentsLeft = bill.cost > 0 ? Math.ceil(remainingBalance / bill.cost) : 0;
    }

    return { nextDate, paymentsMade, remainingBalance, paymentsLeft, isComplete };
};

export const getUpcomingBills = (bills: Bill[]): { bill: Bill; nextDate: Date }[] => {
    const upcoming = bills
        .map(bill => ({ bill, details: getNextPaymentDetails(bill) }))
        // filter out one-time bills that have already been paid
        .filter(u => !u.details.isComplete)
        .map(u => ({ bill: u.bill, nextDate: u.details.nextDate }));

    return upcoming.sort((a, b) => a.nextDate.getTime() - b.nextDate.getTime()).slice(0, 5);
};
