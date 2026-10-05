import { createContext, useContext } from 'react';
import type { Bill, Budget, CreditCard, DebtKind, Income, SavingsGoal } from './FinanceContext';
import type { DueItem } from '../utils/schedule';

// The add/edit modals are rendered once at the app root (so their backdrop can blur the whole screen),
// and any screen can open them through this context.
export interface EditorContextType {
    openBillEditor: (bill?: Bill) => void;
    openIncomeEditor: (income?: Income) => void;
    openBudgetEditor: (budget?: Budget) => void;
    /** Edit `card`, or add a new card / loan (`kind`, default 'card'). */
    openCardEditor: (card?: CreditCard, kind?: DebtKind) => void;
    /** Log spending, optionally pre-selecting a budget. */
    openSpendingEditor: (budgetId?: string) => void;
    /** Mark a bill/card occurrence as paid (or edit/undo its payment). */
    openPaymentSheet: (due: DueItem) => void;
    openGoalEditor: (goal?: SavingsGoal) => void;
    /** Log money put toward a goal, optionally pre-filling Billy's suggested amount. */
    openContributionEditor: (goalId: string, suggested?: number) => void;
}

export const EditorContext = createContext<EditorContextType | undefined>(undefined);

export const useEditor = () => {
    const context = useContext(EditorContext);
    if (context === undefined) {
        throw new Error('useEditor must be used within an EditorContext provider');
    }
    return context;
};
