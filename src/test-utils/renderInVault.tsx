import type { ReactElement } from 'react';
import { act, render, waitFor } from '@testing-library/react-native';
import { FinanceProvider, normalizeVaultData, useFinance, type VaultData } from '../context/FinanceContext';
import { EditorContext, type EditorContextType } from '../context/EditorContext';

type Finance = ReturnType<typeof useFinance>;

export const mockEditor = (): jest.Mocked<EditorContextType> => ({
    openBillEditor: jest.fn(),
    openIncomeEditor: jest.fn(),
    openBudgetEditor: jest.fn(),
    openCardEditor: jest.fn(),
    openSpendingEditor: jest.fn(),
    openPaymentSheet: jest.fn(),
    openCardTransactionEditor: jest.fn(),
    openActualPaySheet: jest.fn(),
    openGoalEditor: jest.fn(),
    openContributionEditor: jest.fn(),
});

/**
 * Renders `ui` inside a real FinanceProvider whose vault has been set up and loaded with `data`. `ui`
 * mounts only once the data is in, like a screen opened after unlocking. The native services must be
 * mocked by the test file (see nativeMocks.ts).
 */
export async function renderInVault(ui: ReactElement, data: Partial<VaultData>, editor: EditorContextType = mockEditor()) {
    let finance: Finance | undefined;
    function Capture() {
        finance = useFinance();
        return null;
    }
    const tree = (children?: ReactElement) => (
        <FinanceProvider>
            <EditorContext.Provider value={editor}>
                <Capture />
                {children}
            </EditorContext.Provider>
        </FinanceProvider>
    );

    const result = await render(tree());
    await waitFor(() => expect(finance?.authStatus).toBe('setup'));
    await act(() => finance!.setupVault('123456'));
    await act(async () => finance!.importData(JSON.stringify(normalizeVaultData(data))));
    await result.rerender(tree(ui));
    return { ...result, editor, finance: () => finance! };
}
