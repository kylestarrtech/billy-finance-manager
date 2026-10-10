// Data model for everything stored in the encrypted vault.

export const PaymentFrequency = {
    Daily: 'daily',
    Weekly: 'weekly',
    Biweekly: 'biweekly',
    Monthly: 'monthly',
    Bimonthly: 'bimonthly',
    Quarterly: 'quarterly',
    Semiannually: 'semiannually',
    Annually: 'annually',
    Onetime: 'onetime'
} as const;

// eslint-disable-next-line @typescript-eslint/no-redeclare -- value + type pair, used like an enum
export type PaymentFrequency = typeof PaymentFrequency[keyof typeof PaymentFrequency];

export interface Bill {
    id: string;
    name: string;
    cost: number;
    frequency: PaymentFrequency;
    firstPaymentDate: string;
    isEssential: boolean;
    note?: string;
}

/** Bills saved before financing moved to Loans may still carry these; see utils/migrate.ts. */
export interface LegacyFinancedBill extends Bill {
    isFinanced?: boolean;
    totalLoanAmount?: number;
    loanTermMonths?: number;
}

export interface Income {
    id: string;
    name: string;
    amount: number;
    frequency: PaymentFrequency;
    initialPaymentDate: string;
    endingPaymentDate?: string; // im adding this just in case someone has short-term contract work
}

/** What one paycheck actually came to (variable hours, overtime...), replacing the income's usual amount. */
export interface IncomeActual {
    id: string;
    incomeId: string;
    /** The scheduled payday this paycheck covers ('YYYY-MM-DD'). */
    payDate: string;
    amount: number;
}

/** A recorded payment for one occurrence of a bill or a credit card's monthly payment. */
export interface Payment {
    id: string;
    kind: 'bill' | 'card';
    /** Id of the bill or credit card. */
    itemId: string;
    /** The scheduled due date this payment covers ('YYYY-MM-DD'). */
    dueDate: string;
    paidDate: string;
    amount: number;
}

export const BudgetPeriod = {
    Weekly: 'weekly',
    Monthly: 'monthly',
    PayPeriod: 'payPeriod',
} as const;

// eslint-disable-next-line @typescript-eslint/no-redeclare -- value + type pair, used like an enum
export type BudgetPeriod = typeof BudgetPeriod[keyof typeof BudgetPeriod];

/** A spending allowance for variable costs (groceries, gas, dining out...). */
export interface Budget {
    id: string;
    name: string;
    amount: number;
    period: BudgetPeriod;
    isEssential: boolean;
    note?: string;
}

/** Money spent against a budget. */
export interface SpendingEntry {
    id: string;
    budgetId: string;
    amount: number;
    date: string;
    note?: string;
    /** Credit card it was put on; the amount was added to that card's balance. */
    cardId?: string;
}

export type DebtKind = 'card' | 'loan';

/**
 * A credit card, or a loan / financed purchase (car loan, phone or furniture financing...). Both are a
 * balance paid down monthly, so they share scheduling, payment tracking and payoff math; `kind` decides
 * how they're shown and whether they count toward credit utilization (only cards do).
 */
export interface CreditCard {
    id: string;
    /** Missing on entries saved before loans existed, which are all cards. */
    kind?: DebtKind;
    name: string;
    /** What's still owed. */
    balance: number;
    /** Annual percentage rate, e.g. 19.99. */
    apr: number;
    /** Cards only. */
    creditLimit?: number;
    /** Cards only. */
    minimumPayment?: number;
    /** What you plan to pay each month (for loans, the installment). */
    plannedPayment: number;
    /** Day of the month the payment is due (1-31, clamped to short months). */
    dueDay: number;
    /** Loans only: the amount financed, to show progress. */
    originalAmount?: number;
    /** Loans only: when a promotional (often deferred-interest) rate ends ('YYYY-MM-DD'). */
    promoEndDate?: string;
}

export const isLoan = (entry: Pick<CreditCard, 'kind'>): boolean => entry.kind === 'loan';

/**
 * A one-off change to a card or loan balance, outside the monthly schedule: an extra payment, or a
 * charge (purchase, fee) on a card. Budget spending put on a card is a SpendingEntry with a cardId instead.
 */
export interface CardTransaction {
    id: string;
    cardId: string;
    /** 'payment' lowers the balance, 'charge' raises it. */
    type: 'payment' | 'charge';
    amount: number;
    date: string;
    note?: string;
}

export interface ReminderSettings {
    enabled: boolean;
    /** 0 = on the due date, 1 = the day before, ... */
    daysBefore: number;
    hour: number;
    minute: number;
    /** Put bill names and amounts in the notification text (visible on the lock screen). */
    showDetails: boolean;
}

export interface AppSettings {
    reminders: ReminderSettings;
    /** Income whose paydays define the pay period; the largest recurring income when unset. */
    payPeriodIncomeId?: string;
}

/** Something you're saving up for. */
export interface SavingsGoal {
    id: string;
    name: string;
    /** Sticker price before tax. */
    price: number;
    /** Sales tax in percent, e.g. 13. */
    taxRate?: number;
    /** When you'd like to have it ('YYYY-MM-DD'). */
    targetDate?: string;
    note?: string;
}

/** Money put aside toward a goal (negative when taken back out). */
export interface GoalContribution {
    id: string;
    goalId: string;
    amount: number;
    date: string;
}

export interface VaultData {
    bills: Bill[];
    incomes: Income[];
    incomeActuals: IncomeActual[];
    payments: Payment[];
    budgets: Budget[];
    spending: SpendingEntry[];
    cards: CreditCard[];
    cardTransactions: CardTransaction[];
    goals: SavingsGoal[];
    contributions: GoalContribution[];
    settings: AppSettings;
}

export const DEFAULT_SETTINGS: AppSettings = {
    reminders: { enabled: false, daysBefore: 1, hour: 9, minute: 0, showDetails: false },
};

export const EMPTY_VAULT: VaultData = {
    bills: [],
    incomes: [],
    incomeActuals: [],
    payments: [],
    budgets: [],
    spending: [],
    cards: [],
    cardTransactions: [],
    goals: [],
    contributions: [],
    settings: DEFAULT_SETTINGS,
};

const asArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

/**
 * Fills in anything missing from older vaults/exports (which only had bills and incomes), so every
 * field is always present after unlocking or importing.
 */
export function normalizeVaultData(raw: Partial<VaultData> | null | undefined): VaultData {
    const settings = raw?.settings;
    return {
        bills: asArray<Bill>(raw?.bills),
        incomes: asArray<Income>(raw?.incomes),
        incomeActuals: asArray<IncomeActual>(raw?.incomeActuals),
        payments: asArray<Payment>(raw?.payments),
        budgets: asArray<Budget>(raw?.budgets),
        spending: asArray<SpendingEntry>(raw?.spending),
        cards: asArray<CreditCard>(raw?.cards),
        cardTransactions: asArray<CardTransaction>(raw?.cardTransactions),
        goals: asArray<SavingsGoal>(raw?.goals),
        contributions: asArray<GoalContribution>(raw?.contributions),
        settings: {
            ...DEFAULT_SETTINGS,
            ...settings,
            reminders: { ...DEFAULT_SETTINGS.reminders, ...settings?.reminders },
        },
    };
}
