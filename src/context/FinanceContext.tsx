import { createContext, useContext, useState, useEffect, type ReactNode, useRef, useCallback } from 'react';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { randomUUID } from 'expo-crypto';
import {
    EMPTY_VAULT,
    type AppSettings,
    type Bill,
    type Budget,
    type CreditCard,
    type GoalContribution,
    type Income,
    type SavingsGoal,
    type Payment,
    type SpendingEntry,
    type VaultData,
} from '../types';
import { storageAdapter } from '../utils/storageAdapter';
import { encryptWithKey, decryptVault, decryptVaultWithKey, deriveVaultKey, type VaultKey } from '../utils/cryptoWrapper';
import { confirmAsync, showAlert } from '../utils/dialogs';
import {
    disableBiometricUnlock,
    enableBiometricUnlock,
    getBiometricSupport,
    getVaultKeyWithBiometrics,
    isBiometricUnlockEnabled,
    type BiometricSupport,
} from '../utils/biometrics';
import { buildReminderPlan } from '../utils/reminders';
import { cancelAllReminders, hasReminderPermission, scheduleReminders } from '../utils/notifications';
import { dueKey } from '../utils/schedule';
import { loadVaultData } from '../utils/migrate';

export * from '../types';

export type AuthStatus = 'loading' | 'setup' | 'locked' | 'unlocked';

/** Identifies one scheduled occurrence of a bill or card payment. */
export interface DueRef {
    kind: Payment['kind'];
    itemId: string;
    dueDate: string;
}

interface FinanceContextType {
    data: VaultData;
    bills: Bill[];
    incomes: Income[];
    payments: Payment[];
    budgets: Budget[];
    spending: SpendingEntry[];
    cards: CreditCard[];
    goals: SavingsGoal[];
    contributions: GoalContribution[];
    settings: AppSettings;
    authStatus: AuthStatus;
    unlockVault: (pin: string) => Promise<boolean>;
    setupVault: (pin: string) => Promise<void>;
    lockVault: () => void;
    biometricSupport: BiometricSupport | null;
    biometricEnabled: boolean;
    setBiometricUnlock: (enabled: boolean) => Promise<boolean>;
    unlockWithBiometrics: () => Promise<'ok' | 'cancelled' | 'unavailable'>;
    addBill: (bill: Omit<Bill, 'id'>) => void;
    editBill: (id: string, updatedBill: Omit<Bill, 'id'>) => void;
    deleteBill: (id: string) => void;
    addIncome: (income: Omit<Income, 'id'>) => void;
    editIncome: (id: string, updatedIncome: Omit<Income, 'id'>) => void;
    deleteIncome: (id: string) => void;
    addBudget: (budget: Omit<Budget, 'id'>) => void;
    editBudget: (id: string, budget: Omit<Budget, 'id'>) => void;
    deleteBudget: (id: string) => void;
    addSpending: (entry: Omit<SpendingEntry, 'id'>) => void;
    deleteSpending: (id: string) => void;
    addGoal: (goal: Omit<SavingsGoal, 'id'>) => void;
    editGoal: (id: string, goal: Omit<SavingsGoal, 'id'>) => void;
    deleteGoal: (id: string) => void;
    addContribution: (entry: Omit<GoalContribution, 'id'>) => void;
    deleteContribution: (id: string) => void;
    addCard: (card: Omit<CreditCard, 'id'>) => void;
    editCard: (id: string, card: Omit<CreditCard, 'id'>) => void;
    deleteCard: (id: string) => void;
    /** Records (or updates) a payment for one due occurrence. Card payments reduce the card's balance. */
    markPaid: (due: DueRef, amount: number, paidDate: string) => void;
    unmarkPaid: (paymentId: string) => void;
    updateSettings: (update: (settings: AppSettings) => AppSettings) => void;
    exportData: () => Promise<void>;
    importData: (jsonData: string) => void;
    clearAllData: () => Promise<void>;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

const EXPORT_FILE_NAME = 'billy-bill-manager-export.json';

// The plaintext export is written to the cache dir only so the share sheet can hand it off.
// Removing it immediately could break a share target that reads it lazily, so it's cleaned up on the
// next launch/lock instead.
const removeExportFile = () => {
    try {
        const file = new File(Paths.cache, EXPORT_FILE_NAME);
        if (file.exists) file.delete();
    } catch (e) {
        console.warn('Could not remove export file:', e);
    }
};

type ListKey = 'bills' | 'incomes' | 'budgets' | 'spending' | 'cards' | 'payments' | 'goals' | 'contributions';

export const FinanceProvider = ({ children }: { children: ReactNode }) => {
    const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');
    const [data, setData] = useState<VaultData>(EMPTY_VAULT);
    const [biometricSupport, setBiometricSupport] = useState<BiometricSupport | null>(null);
    const [biometricEnabled, setBiometricEnabled] = useState(false);
    const vaultKeyRef = useRef<VaultKey | null>(null);
    // Saves are chained so writes always land in order, even if state changes in quick succession.
    const saveChainRef = useRef<Promise<void>>(Promise.resolve());

    const persist = useCallback((payload: VaultData) => {
        const vaultKey = vaultKeyRef.current;
        if (!vaultKey) return saveChainRef.current;
        saveChainRef.current = saveChainRef.current
            .then(() => storageAdapter.set(encryptWithKey(JSON.stringify(payload), vaultKey)))
            .catch(err => console.error('Failed to save vault:', err));
        return saveChainRef.current;
    }, []);

    // init
    useEffect(() => {
        const init = async () => {
            removeExportFile();
            const [support, enabled] = await Promise.all([getBiometricSupport(), isBiometricUnlockEnabled()]);
            setBiometricSupport(support);
            setBiometricEnabled(enabled && support.available);
            try {
                const vault = await storageAdapter.get();
                if (vault) {
                    setAuthStatus('locked');
                } else {
                    setAuthStatus('setup');
                }
            } catch (err) {
                console.error("StorageAdapter failed to init:", err);
                // Fallback to setup if reading fails completely
                setAuthStatus('setup');
            }
        };
        init();
    }, []);

    const openVault = (plaintext: string, vaultKey: VaultKey) => {
        const parsed = loadVaultData(JSON.parse(plaintext));
        vaultKeyRef.current = vaultKey;
        setData(parsed);
        setAuthStatus('unlocked');
    };

    const unlockVault = async (pin: string): Promise<boolean> => {
        const vault = await storageAdapter.get();
        if (!vault) return false;
        try {
            const { data: plaintext, vaultKey } = await decryptVault(vault, pin);
            openVault(plaintext, vaultKey);
            return true;
        } catch {
            return false;
        }
    };

    const unlockWithBiometrics = async (): Promise<'ok' | 'cancelled' | 'unavailable'> => {
        const result = await getVaultKeyWithBiometrics();
        if (result.status === 'cancelled') return 'cancelled';
        const vault = await storageAdapter.get();
        if (result.status === 'ok' && vault) {
            try {
                openVault(decryptVaultWithKey(vault, result.vaultKey), result.vaultKey);
                return 'ok';
            } catch {
                // Key from an older vault (wiped and set up again); fall through and turn it off.
            }
        }
        await disableBiometricUnlock();
        setBiometricEnabled(false);
        return 'unavailable';
    };

    const setupVault = async (pin: string) => {
        vaultKeyRef.current = await deriveVaultKey(pin);
        // immediately trigger a save so the vault is actually created
        await persist(data);
        setAuthStatus('unlocked');
    };

    // Drops the decrypted data and key from memory; the PIN (or biometrics) is needed again to get back in.
    const lockVault = useCallback(() => {
        vaultKeyRef.current = null;
        removeExportFile();
        setData(EMPTY_VAULT);
        setAuthStatus(status => (status === 'unlocked' ? 'locked' : status));
    }, []);

    const setBiometricUnlock = async (enabled: boolean): Promise<boolean> => {
        if (!enabled) {
            await disableBiometricUnlock();
            setBiometricEnabled(false);
            return true;
        }
        const vaultKey = vaultKeyRef.current;
        if (!vaultKey || !biometricSupport?.available) return false;
        const ok = await enableBiometricUnlock(vaultKey, biometricSupport.label);
        setBiometricEnabled(ok);
        return ok;
    };

    // autosave
    useEffect(() => {
        if (authStatus === 'unlocked') {
            persist(data);
        }
    }, [data, authStatus, persist]);

    // Keep the scheduled bill reminders in step with the data (debounced so a burst of edits reschedules once).
    useEffect(() => {
        if (authStatus !== 'unlocked') return;
        const timer = setTimeout(async () => {
            try {
                if (!data.settings.reminders.enabled) {
                    await cancelAllReminders();
                } else if (await hasReminderPermission()) {
                    await scheduleReminders(buildReminderPlan(data, data.settings.reminders, new Date()));
                }
            } catch (e) {
                console.warn('Could not update bill reminders:', e);
            }
        }, 1500);
        return () => clearTimeout(timer);
    }, [data, authStatus]);

    const addTo = <K extends ListKey>(key: K, item: Omit<VaultData[K][number], 'id'>) => {
        setData(d => ({ ...d, [key]: [...d[key], { ...item, id: randomUUID() }] }));
    };

    const replaceIn = <K extends ListKey>(key: K, id: string, item: Omit<VaultData[K][number], 'id'>) => {
        setData(d => ({ ...d, [key]: (d[key] as { id: string }[]).map(existing => (existing.id === id ? { ...item, id } : existing)) }));
    };

    const addBill = (bill: Omit<Bill, 'id'>) => addTo('bills', bill);
    const editBill = (id: string, updatedBill: Omit<Bill, 'id'>) => replaceIn('bills', id, updatedBill);
    const deleteBill = (id: string) => {
        setData(d => ({
            ...d,
            bills: d.bills.filter(bill => bill.id !== id),
            payments: d.payments.filter(p => !(p.kind === 'bill' && p.itemId === id)),
        }));
    };

    const addIncome = (income: Omit<Income, 'id'>) => addTo('incomes', income);
    const editIncome = (id: string, updatedIncome: Omit<Income, 'id'>) => replaceIn('incomes', id, updatedIncome);
    const deleteIncome = (id: string) => {
        setData(d => ({
            ...d,
            incomes: d.incomes.filter(income => income.id !== id),
            settings: d.settings.payPeriodIncomeId === id ? { ...d.settings, payPeriodIncomeId: undefined } : d.settings,
        }));
    };

    const addBudget = (budget: Omit<Budget, 'id'>) => addTo('budgets', budget);
    const editBudget = (id: string, budget: Omit<Budget, 'id'>) => replaceIn('budgets', id, budget);
    const deleteBudget = (id: string) => {
        setData(d => ({
            ...d,
            budgets: d.budgets.filter(b => b.id !== id),
            spending: d.spending.filter(e => e.budgetId !== id),
        }));
    };

    const addSpending = (entry: Omit<SpendingEntry, 'id'>) => addTo('spending', entry);
    const deleteSpending = (id: string) => setData(d => ({ ...d, spending: d.spending.filter(e => e.id !== id) }));

    const addGoal = (goal: Omit<SavingsGoal, 'id'>) => addTo('goals', goal);
    const editGoal = (id: string, goal: Omit<SavingsGoal, 'id'>) => replaceIn('goals', id, goal);
    const deleteGoal = (id: string) => {
        setData(d => ({
            ...d,
            goals: d.goals.filter(g => g.id !== id),
            contributions: d.contributions.filter(c => c.goalId !== id),
        }));
    };

    const addContribution = (entry: Omit<GoalContribution, 'id'>) => addTo('contributions', entry);
    const deleteContribution = (id: string) => setData(d => ({ ...d, contributions: d.contributions.filter(c => c.id !== id) }));

    const addCard = (card: Omit<CreditCard, 'id'>) => addTo('cards', card);
    const editCard = (id: string, card: Omit<CreditCard, 'id'>) => replaceIn('cards', id, card);
    const deleteCard = (id: string) => {
        setData(d => ({
            ...d,
            cards: d.cards.filter(c => c.id !== id),
            payments: d.payments.filter(p => !(p.kind === 'card' && p.itemId === id)),
        }));
    };

    const adjustCardBalance = (cards: CreditCard[], cardId: string, paidDelta: number) =>
        cards.map(c => (c.id === cardId ? { ...c, balance: Math.max(0, Math.round((c.balance - paidDelta) * 100) / 100) } : c));

    const markPaid = (due: DueRef, amount: number, paidDate: string) => {
        setData(d => {
            const key = dueKey(due.kind, due.itemId, due.dueDate);
            const existing = d.payments.find(p => dueKey(p.kind, p.itemId, p.dueDate) === key);
            const payment: Payment = { id: existing?.id ?? randomUUID(), ...due, paidDate, amount };
            const payments = existing ? d.payments.map(p => (p.id === existing.id ? payment : p)) : [...d.payments, payment];
            const cards = due.kind === 'card' ? adjustCardBalance(d.cards, due.itemId, amount - (existing?.amount ?? 0)) : d.cards;
            return { ...d, payments, cards };
        });
    };

    const unmarkPaid = (paymentId: string) => {
        setData(d => {
            const payment = d.payments.find(p => p.id === paymentId);
            if (!payment) return d;
            return {
                ...d,
                payments: d.payments.filter(p => p.id !== paymentId),
                cards: payment.kind === 'card' ? adjustCardBalance(d.cards, payment.itemId, -payment.amount) : d.cards,
            };
        });
    };

    const updateSettings = (update: (settings: AppSettings) => AppSettings) => {
        setData(d => ({ ...d, settings: update(d.settings) }));
    };

    const exportData = async () => {
        const confirmed = await confirmAsync(
            'Export Data',
            'WARNING: Exporting creates an UNENCRYPTED copy of your sensitive financial information and opens the share sheet so you can save it (for example to Files or Drive). Please make sure wherever you save it is secure.\n\nDo you wish to proceed?',
            { confirmText: 'Export' }
        );
        if (!confirmed) return;

        if (!(await Sharing.isAvailableAsync())) {
            showAlert('Export Failed', 'Sharing is not available on this device.');
            return;
        }

        try {
            const file = new File(Paths.cache, EXPORT_FILE_NAME);
            if (file.exists) file.delete();
            file.create();
            file.write(JSON.stringify(data, null, 2));
            await Sharing.shareAsync(file.uri, {
                mimeType: 'application/json',
                UTI: 'public.json',
                dialogTitle: 'Export Billy data',
            });
        } catch (error) {
            showAlert('Export Failed', String(error));
        }
    };

    const importData = (jsonData: string) => {
        // The vault can auto-lock while the system file picker is open; don't import into a locked app.
        if (!vaultKeyRef.current) {
            showAlert('Import Cancelled', 'The vault was locked while choosing a file. Unlock it and try again.');
            return;
        }
        try {
            const parsed = JSON.parse(jsonData);
            if (Array.isArray(parsed.bills) && Array.isArray(parsed.incomes)) {
                // Desktop exports only contain bills and incomes; keep everything else they don't include.
                setData(current => {
                    const imported = loadVaultData(parsed);
                    const pick = <K extends ListKey>(key: K) => (Array.isArray(parsed[key]) ? imported[key] : current[key]);
                    const bills = imported.bills;
                    // Without a cards list, imported.cards holds only loans migrated from financed bills.
                    const cards = Array.isArray(parsed.cards) ? imported.cards : [...current.cards, ...imported.cards];
                    const budgets = pick('budgets');
                    const goals = pick('goals');
                    const billIds = new Set(bills.map(b => b.id));
                    const cardIds = new Set(cards.map(c => c.id));
                    const budgetIds = new Set(budgets.map(b => b.id));
                    const goalIds = new Set(goals.map(g => g.id));
                    return {
                        bills,
                        incomes: imported.incomes,
                        cards,
                        budgets,
                        goals,
                        payments: pick('payments').filter(p => (p.kind === 'bill' ? billIds : cardIds).has(p.itemId)),
                        spending: pick('spending').filter(e => budgetIds.has(e.budgetId)),
                        contributions: pick('contributions').filter(c => goalIds.has(c.goalId)),
                        settings: parsed.settings ? imported.settings : current.settings,
                    };
                });
                showAlert('Import Complete', 'Data successfully imported!');
            } else {
                showAlert('Import Failed', 'Invalid data structure in JSON file.');
            }
        } catch {
            showAlert('Import Failed', 'Could not parse JSON file.');
        }
    };

    const clearAllData = async () => {
        vaultKeyRef.current = null;
        await saveChainRef.current;
        await storageAdapter.clear();
        await disableBiometricUnlock();
        await cancelAllReminders().catch(() => {});
        setBiometricEnabled(false);
        removeExportFile();
        setData(EMPTY_VAULT);
        setAuthStatus('setup');
    };

    return (
        <FinanceContext.Provider value={{
            data,
            bills: data.bills,
            incomes: data.incomes,
            payments: data.payments,
            budgets: data.budgets,
            spending: data.spending,
            cards: data.cards,
            goals: data.goals,
            contributions: data.contributions,
            settings: data.settings,
            authStatus,
            unlockVault,
            setupVault,
            lockVault,
            biometricSupport,
            biometricEnabled,
            setBiometricUnlock,
            unlockWithBiometrics,
            addBill,
            editBill,
            deleteBill,
            addIncome,
            editIncome,
            deleteIncome,
            addBudget,
            editBudget,
            deleteBudget,
            addSpending,
            deleteSpending,
            addGoal,
            editGoal,
            deleteGoal,
            addContribution,
            deleteContribution,
            addCard,
            editCard,
            deleteCard,
            markPaid,
            unmarkPaid,
            updateSettings,
            exportData,
            importData,
            clearAllData
        }}
    >
        {children}
    </FinanceContext.Provider>
    );
}

export const useFinance  = () => {
    const context = useContext(FinanceContext);
    if (context === undefined) {
        throw new Error('useFinance must be used within a FinanceProvider');
    }
    return context;
}
