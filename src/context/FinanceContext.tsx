import { createContext, useContext, useState, useEffect, type ReactNode, useRef, useCallback } from 'react';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { randomUUID } from 'expo-crypto';
import { storageAdapter } from '../utils/storageAdapter';
import { encryptWithKey, decryptVault, deriveVaultKey, type VaultKey } from '../utils/cryptoWrapper';
import { confirmAsync, showAlert } from '../utils/dialogs';

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
    isFinanced: boolean;
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

export type AuthStatus = 'loading' | 'setup' | 'locked' | 'unlocked';

interface FinanceContextType {
    bills: Bill[];
    incomes: Income[];
    authStatus: AuthStatus;
    unlockVault: (pin: string) => Promise<boolean>;
    setupVault: (pin: string) => Promise<void>;
    lockVault: () => void;
    addBill: (bill: Omit<Bill, 'id'>) => void;
    editBill: (id: string, updatedBill: Omit<Bill, 'id'>) => void;
    deleteBill: (id: string) => void;
    addIncome: (income: Omit<Income, 'id'>) => void;
    editIncome: (id: string, updatedIncome: Omit<Income, 'id'>) => void;
    deleteIncome: (id: string) => void;
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

export const FinanceProvider = ({ children }: { children: ReactNode }) => {
    const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');
    const [bills, setBills] = useState<Bill[]>([]);
    const [incomes, setIncomes] = useState<Income[]>([]);
    const vaultKeyRef = useRef<VaultKey | null>(null);
    // Saves are chained so writes always land in order, even if state changes in quick succession.
    const saveChainRef = useRef<Promise<void>>(Promise.resolve());

    const persist = useCallback((payload: { bills: Bill[]; incomes: Income[] }) => {
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

    const unlockVault = async (pin: string): Promise<boolean> => {
        const vault = await storageAdapter.get();
        if (!vault) return false;
        try {
            const { data, vaultKey } = await decryptVault(vault, pin);
            const parsed = JSON.parse(data);
            vaultKeyRef.current = vaultKey;
            setBills(parsed.bills || []);
            setIncomes(parsed.incomes || []);
            setAuthStatus('unlocked');
            return true;
        } catch {
            return false;
        }
    };

    const setupVault = async (pin: string) => {
        vaultKeyRef.current = await deriveVaultKey(pin);
        // immediately trigger a save so the vault is actually created
        await persist({ bills, incomes });
        setAuthStatus('unlocked');
    };

    // Drops the decrypted data and key from memory; the PIN is needed again to get back in.
    const lockVault = useCallback(() => {
        vaultKeyRef.current = null;
        removeExportFile();
        setBills([]);
        setIncomes([]);
        setAuthStatus(status => (status === 'unlocked' ? 'locked' : status));
    }, []);

    // autosave
    useEffect(() => {
        if (authStatus === 'unlocked') {
            persist({ bills, incomes });
        }
    }, [bills, incomes, authStatus, persist]);

    const addBill = (bill: Omit<Bill, 'id'>) => {
        const newBill = { ...bill, id: randomUUID() };
        setBills(prev => [...prev, newBill]);
    };

    const editBill = (id: string, updatedBill: Omit<Bill, 'id'>) => {
        setBills(prev => prev.map(
            bill => bill.id === id ? { ...updatedBill, id } : bill
        ));
    };

    const deleteBill = (id: string) => {
        setBills(prev => prev.filter(bill => bill.id !== id));
    };

    const addIncome = (income: Omit<Income, 'id'>) => {
        const newIncome = { ...income, id: randomUUID() };
        setIncomes(prev => [...prev, newIncome]);
    };

    const editIncome = (id: string, updatedIncome: Omit<Income, 'id'>) => {
        setIncomes(prev => prev.map(
            income => income.id === id ? { ...updatedIncome, id } : income
        ))
    };

    const deleteIncome = (id: string) => {
        setIncomes(prev => prev.filter(income => income.id !== id));
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
            file.write(JSON.stringify({ bills, incomes }, null, 2));
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
                setBills(parsed.bills);
                setIncomes(parsed.incomes);
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
        removeExportFile();
        setBills([]);
        setIncomes([]);
        setAuthStatus('setup');
    };

    return (
        <FinanceContext.Provider value={{
            bills,
            incomes,
            authStatus,
            unlockVault,
            setupVault,
            lockVault,
            addBill,
            editBill,
            deleteBill,
            addIncome,
            editIncome,
            deleteIncome,
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
