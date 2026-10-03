import { createContext, useContext } from 'react';
import type { Bill, Income } from './FinanceContext';

// The add/edit modals are rendered once at the app root (so their backdrop can blur the whole screen),
// and any screen can open them through this context.
export interface EditorContextType {
    openBillEditor: (bill?: Bill) => void;
    openIncomeEditor: (income?: Income) => void;
}

export const EditorContext = createContext<EditorContextType | undefined>(undefined);

export const useEditor = () => {
    const context = useContext(EditorContext);
    if (context === undefined) {
        throw new Error('useEditor must be used within an EditorContext provider');
    }
    return context;
};
