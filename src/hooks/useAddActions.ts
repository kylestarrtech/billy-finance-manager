import { useEditor } from '../context/EditorContext';
import { useFinance } from '../context/FinanceContext';
import type { FloatingAction } from '../context/TabChromeContext';

export type AddActionKind = 'bill' | 'income' | 'spend' | 'budget' | 'card' | 'loan' | 'goal';

/** Floating add buttons, by kind. "spend" is dropped when there are no budgets to log against. */
export function useAddActions(kinds: AddActionKind[]): FloatingAction[] {
    const editor = useEditor();
    const { budgets } = useFinance();
    const all: Record<AddActionKind, FloatingAction> = {
        bill: { label: '+ Bill', onPress: () => editor.openBillEditor() },
        income: { label: '+ Income', onPress: () => editor.openIncomeEditor() },
        spend: { label: '+ Spend', onPress: () => editor.openSpendingEditor() },
        budget: { label: '+ Budget', onPress: () => editor.openBudgetEditor() },
        card: { label: '+ Card', onPress: () => editor.openCardEditor(undefined, 'card') },
        loan: { label: '+ Loan', onPress: () => editor.openCardEditor(undefined, 'loan') },
        goal: { label: '+ Goal', onPress: () => editor.openGoalEditor() },
    };
    return kinds.filter(k => k !== 'spend' || budgets.length > 0).map(k => all[k]);
}
