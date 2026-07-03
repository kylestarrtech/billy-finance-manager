import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';


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

interface FinanceContextType {
    bills: Bill[];
    incomes: Income[];
    addBill: (bill: Omit<Bill, 'id'>) => void;
    editBill: (id: string, updatedBill: Omit<Bill, 'id'>) => void;
    deleteBill: (id: string) => void;
    addIncome: (income: Omit<Income, 'id'>) => void;
    editIncome: (id: string, updatedIncome: Omit<Income, 'id'>) => void;
    deleteIncome: (id: string) => void;
    exportData: () => void;
    importData: (jsonData: string) => void;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

export const FinanceProvider = ({ children }: { children: ReactNode }) => {

    // grab bills once on initial render via local storage
    const [bills, setBills] = useState<Bill[]>(() => {
        const saved = localStorage.getItem('bills');
        return saved ? JSON.parse(saved) : [];
    })

    // same thing with income
    const [incomes, setIncomes] = useState<Income[]>(() => {
        const saved = localStorage.getItem('incomes');
        return saved ? JSON.parse(saved) : [];
    });

    // get save data

    // im adding this comment because i KNOW im going to forget since im still learning this
    // but useEffect allows us to run "side effects" that will run post-render and only when
    // the dependencies (which is the last argument) changes. so basically whenever bills
    // or incomes change in the financeprovider these trigger. it's an autosave.
    useEffect(() => {
        localStorage.setItem('bills', JSON.stringify(bills));
    }, [bills]);

    useEffect(() => {
        localStorage.setItem('incomes', JSON.stringify(incomes));
    }, [incomes]);

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
        if (window.confirm('WARNING: Exporting data will download your sensitive financial information to your device unencrypted. Please ensure your device is secure. Do you wish to proceed?')) {
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

    return (
        <FinanceContext.Provider value={{
            bills,
            incomes,
            addBill,
            editBill,
            deleteBill,
            addIncome,
            editIncome,
            deleteIncome,
            exportData,
            importData
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