import { createContext, useContext, useState, useEffect, type ReactNode, useRef } from 'react';
import { storageAdapter } from '../utils/storageAdapter';
import { encryptData, decryptData } from '../utils/cryptoWrapper';

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
    addBill: (bill: Omit<Bill, 'id'>) => void;
    editBill: (id: string, updatedBill: Omit<Bill, 'id'>) => void;
    deleteBill: (id: string) => void;
    addIncome: (income: Omit<Income, 'id'>) => void;
    editIncome: (id: string, updatedIncome: Omit<Income, 'id'>) => void;
    deleteIncome: (id: string) => void;
    exportData: () => void;
    importData: (jsonData: string) => void;
    clearAllData: () => Promise<void>;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

export const FinanceProvider = ({ children }: { children: ReactNode }) => {
    const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');
    const [bills, setBills] = useState<Bill[]>([]);
    const [incomes, setIncomes] = useState<Income[]>([]);
    const currentPinRef = useRef<string | null>(null);

    // init
    useEffect(() => {
        const init = async () => {
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
            const decrypted = await decryptData(vault, pin);
            const parsed = JSON.parse(decrypted);
            setBills(parsed.bills || []);
            setIncomes(parsed.incomes || []);
            currentPinRef.current = pin;
            setAuthStatus('unlocked');
            return true;
        } catch (error) {
            return false;
        }
    };

    const setupVault = async (pin: string) => {
        currentPinRef.current = pin;
        setAuthStatus('unlocked');
        
        // immediately trigger a save so the vault is actually created (it crashes if i dont do this)
        const payload = JSON.stringify({ bills, incomes });
        const encrypted = await encryptData(payload, pin);
        await storageAdapter.set(encrypted);
    };

    // autosave
    useEffect(() => {
        if (authStatus === 'unlocked' && currentPinRef.current) {
            const save = async () => {
                const payload = JSON.stringify({ bills, incomes });
                const encrypted = await encryptData(payload, currentPinRef.current!);
                await storageAdapter.set(encrypted);
            };
            save();
        }
    }, [bills, incomes, authStatus]);

    const addBill = (bill: Omit<Bill, 'id'>) => {
        const newBill = { ...bill, id: crypto.randomUUID() };
        setBills([...bills, newBill])
    };

    const editBill = (id: string, updatedBill: Omit<Bill, 'id'>) => {
        setBills(bills.map(
            bill => bill.id === id ? { ...updatedBill, id } : bill
        ));
    };

    const deleteBill = (id: string) => {
        setBills(bills.filter(bill => bill.id !== id));
    };

    const addIncome = (income: Omit<Income, 'id'>) => {
        const newIncome = { ...income, id: crypto.randomUUID() };
        setIncomes([...incomes, newIncome]);
    };
    
    const editIncome = (id: string, updatedIncome: Omit<Income, 'id'>) => {
        setIncomes(incomes.map(
            income => income.id === id ? { ...updatedIncome, id } : income
        ))
    };

    const deleteIncome = (id: string) => {
        setIncomes(incomes.filter(income => income.id !== id));
    };

    const exportData = () => {
        if (window.confirm('WARNING: Exporting data will download your sensitive financial information to your device unencrypted. Please ensure your device is secure. If you do proceed, please check your Downloads folder.\n\n npDo you wish to proceed?')) {
            const dataStr = JSON.stringify({ bills, incomes }, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'billy-bill-manager-export.json';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }
    };

    const importData = (jsonData: string) => {
        try {
            const parsed = JSON.parse(jsonData);
            if (Array.isArray(parsed.bills) && Array.isArray(parsed.incomes)) {
                setBills(parsed.bills);
                setIncomes(parsed.incomes);
                alert('Data successfully imported!');
            } else {
                alert('Import Failed: Invalid data structure in JSON file.');
            }
        } catch (error) {
            alert('Import Failed: Could not parse JSON file.');
        }
    };

    const clearAllData = async () => {
        await storageAdapter.clear();
        localStorage.removeItem('bills');
        localStorage.removeItem('incomes');
        setBills([]);
        setIncomes([]);
        currentPinRef.current = null;
        setAuthStatus('setup');
    };

    return (
        <FinanceContext.Provider value={{
            bills,
            incomes,
            authStatus,
            unlockVault,
            setupVault,
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