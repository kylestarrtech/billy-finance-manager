import { useState } from 'react';
import { useFinance, PaymentFrequency, type Income } from '../context/FinanceContext';

interface AddIncomeProps {
    onClose: () => void;
    incomeToEdit?: Income;
}

export default function AddIncome({ onClose, incomeToEdit }: AddIncomeProps) {
    const { addIncome, editIncome } = useFinance();
    const [isClosing, setIsClosing] = useState(false);
    const [name, setName] = useState(incomeToEdit?.name || '');
    const [amount, setAmount] = useState<number | ''>(incomeToEdit?.amount !== undefined ? incomeToEdit.amount : '');
    const [frequency, setFrequency] = useState<PaymentFrequency>(incomeToEdit?.frequency || PaymentFrequency.Monthly);
    const [initialPaymentDate, setInitialPaymentDate] = useState(incomeToEdit?.initialPaymentDate || '');
    const [endingPaymentDate, setEndingPaymentDate] = useState(incomeToEdit?.endingPaymentDate || '');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || amount === '' || !initialPaymentDate) return;

        const payload = {
            name,
            amount: Number(amount),
            frequency,
            initialPaymentDate,
            ...(endingPaymentDate ? { endingPaymentDate } : {})
        };

        if (incomeToEdit) {
            editIncome(incomeToEdit.id, payload);
        } else {
            addIncome(payload);
        }
        handleClose();
    };

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(onClose, 250);
    };

    return (
        <div className={`modal-backdrop ${isClosing ? 'closing' : ''}`} onMouseDown={handleClose}>
            <div className="modal-content" onMouseDown={(e) => e.stopPropagation()}>
                <h2>{incomeToEdit ? 'Edit Income' : 'Add Income'}</h2>
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label>Name</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} required />
                </div>
                <div className="form-group">
                    <label>Amount</label>
                    <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value ? Number(e.target.value) : '')} required />
                </div>
                <div className="form-group">
                    <label>Frequency</label>
                    <select value={frequency} onChange={e => setFrequency(e.target.value as PaymentFrequency)}>
                        {Object.values(PaymentFrequency).map(freq => (
                            <option key={freq} value={freq}>{freq.charAt(0).toUpperCase() + freq.slice(1)}</option>
                        ))}
                    </select>
                </div>
                <div className="form-group">
                    <label>Initial Payment Date</label>
                    <input type="date" value={initialPaymentDate} onChange={e => setInitialPaymentDate(e.target.value)} required />
                </div>
                <div className="form-group">
                    <label>Ending Payment Date (Optional)</label>
                    <input type="date" value={endingPaymentDate} onChange={e => setEndingPaymentDate(e.target.value)} />
                </div>
                <div className="form-actions">
                    <button type="button" className="btn-secondary" onClick={handleClose}>Cancel</button>
                    <button type="submit" className="btn-primary">{incomeToEdit ? 'Save Changes' : 'Add Income'}</button>
                </div>
            </form>
        </div>
        </div>
    );
}