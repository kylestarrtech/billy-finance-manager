import { type Bill, type Income, PaymentFrequency } from '../context/FinanceContext.tsx';

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

export const getNextPaymentDetails = (bill: Bill) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let nextDate = new Date(bill.firstPaymentDate);
    nextDate.setHours(0, 0, 0, 0);

    let paymentsMade = 0;
    while (nextDate < today && paymentsMade < 1000) {
        paymentsMade++;
        switch (bill.frequency) {
            case PaymentFrequency.Daily:
                nextDate.setDate(nextDate.getDate() + 1);
                break;
            case PaymentFrequency.Weekly:
                nextDate.setDate(nextDate.getDate() + 7);
                break;
            case PaymentFrequency.Biweekly:
                nextDate.setDate(nextDate.getDate() + 14);
                break;
            case PaymentFrequency.Monthly:
                nextDate.setMonth(nextDate.getMonth() + 1);
                break;
            case PaymentFrequency.Bimonthly:
                nextDate.setMonth(nextDate.getMonth() + 2);
                break;
            case PaymentFrequency.Quarterly:
                nextDate.setMonth(nextDate.getMonth() + 3);
                break;
            case PaymentFrequency.Semiannually:
                nextDate.setMonth(nextDate.getMonth() + 6);
                break;
            case PaymentFrequency.Annually:
                nextDate.setFullYear(nextDate.getFullYear() + 1);
                break;
            case PaymentFrequency.Onetime:
                nextDate.setFullYear(nextDate.getFullYear() + 100);
                break;
            default:
                nextDate.setMonth(nextDate.getMonth() + 1);
                break;
        }
    }

    let paymentsLeft = 0;
    let remainingBalance = 0;
    if (bill.isFinanced && bill.totalLoanAmount) {
        remainingBalance = Math.max(0, bill.totalLoanAmount - (bill.cost * paymentsMade));
        paymentsLeft = Math.ceil(remainingBalance / bill.cost);
    }

    return { nextDate, paymentsMade, remainingBalance, paymentsLeft };
};

export const getUpcomingBills = (bills: Bill[]): { bill: Bill; nextDate: Date }[] => {
    const today = new Date();
    // Setting to midnight to avoid time-of-day discrepancies
    today.setHours(0,0,0,0);

    const upcoming = bills.map(bill => {
        const details = getNextPaymentDetails(bill);
        return { bill, nextDate: details.nextDate };
    });

    // filter out those unrealistic onetime past ones
    const validUpcoming = upcoming.filter(u => u.nextDate.getFullYear() - today.getFullYear() < 50);

    return validUpcoming.sort((a, b) => a.nextDate.getTime() - b.nextDate.getTime()).slice(0, 5);
};