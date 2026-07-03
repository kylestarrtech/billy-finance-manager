import { useState } from 'react';
import { useFinance, PaymentFrequency, type Bill } from '../context/FinanceContext';

interface AddBillProps {
    onClose: () => void;
    billToEdit?: Bill;
}

export default function AddBill({ onClose, billToEdit }: AddBillProps) {
    const { addBill, editBill } = useFinance();
    const [isClosing, setIsClosing] = useState(false);
    const [name, setName] = useState(billToEdit?.name || '');
    const [cost, setCost] = useState<number | ''>(billToEdit?.cost !== undefined ? billToEdit.cost : '');
    const [frequency, setFrequency] = useState<PaymentFrequency>(billToEdit?.frequency || PaymentFrequency.Monthly);
    const [firstPaymentDate, setFirstPaymentDate] = useState(billToEdit?.firstPaymentDate || '');
    const [isEssential, setIsEssential] = useState(billToEdit?.isEssential ?? true);
    const [note, setNote] = useState(billToEdit?.note || '');
    const [isFinanced, setIsFinanced] = useState(billToEdit?.isFinanced ?? false);
    const [totalLoanAmount, setTotalLoanAmount] = useState<number | ''>(billToEdit?.totalLoanAmount !== undefined ? billToEdit.totalLoanAmount : '');
    const [loanTermMonths, setLoanTermMonths] = useState<number | ''>(billToEdit?.loanTermMonths !== undefined ? billToEdit.loanTermMonths : '');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || cost === '' || !firstPaymentDate) return;

        const payload = {
            name,
            cost: Number(cost),
            frequency,
            firstPaymentDate,
            isEssential,
            ...(note ? { note } : {}),
            isFinanced,
            ...(isFinanced && totalLoanAmount ? { totalLoanAmount: Number(totalLoanAmount) } : {}),
            ...(isFinanced && loanTermMonths ? { loanTermMonths: Number(loanTermMonths) } : {})
        };

        if (billToEdit) {
            editBill(billToEdit.id, payload);
        } else {
            addBill(payload);
        }
        handleClose();
    };

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(onClose, 250);
    };

    return (
        <div className={`modal-backdrop ${isClosing ? 'closing' : ''}`} onMouseDown={handleClose}>
            <div className="modal-content" style={{ maxHeight: '90vh', overflowY: 'auto' }} onMouseDown={(e) => e.stopPropagation()}>
                <h2>{billToEdit ? 'Edit Bill' : 'Add Bill'}</h2>
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label>Name</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} required />
                </div>
                <div className="form-group">
                    <label>Cost</label>
                    <input type="number" step="0.01" value={cost} onChange={e => setCost(e.target.value ? Number(e.target.value) : '')} required />
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
                    <label>First Payment Date</label>
                    <input type="date" value={firstPaymentDate} onChange={e => setFirstPaymentDate(e.target.value)} required />
                </div>
                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input type="checkbox" id="essential-checkbox" checked={isEssential} onChange={e => setIsEssential(e.target.checked)} style={{ width: 'auto' }} />
                    <label htmlFor="essential-checkbox" style={{ margin: 0 }}>Is Essential</label>
                </div>
                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input type="checkbox" id="financed-checkbox" checked={isFinanced} onChange={e => setIsFinanced(e.target.checked)} style={{ width: 'auto' }} />
                    <label htmlFor="financed-checkbox" style={{ margin: 0 }}>Is Financed</label>
                </div>
                
                {isFinanced && (
                    <>
                        <div className="form-group">
                            <label>Total Loan Amount</label>
                            <input type="number" step="0.01" value={totalLoanAmount} onChange={e => setTotalLoanAmount(e.target.value ? Number(e.target.value) : '')} required={isFinanced} />
                        </div>
                        <div className="form-group">
                            <label>Loan Term (Months)</label>
                            <input type="number" value={loanTermMonths} onChange={e => setLoanTermMonths(e.target.value ? Number(e.target.value) : '')} required={isFinanced} />
                        </div>
                    </>
                )}

                <div className="form-group">
                    <label>Note (Optional)</label>
                    <input type="text" value={note} onChange={e => setNote(e.target.value)} />
                </div>

                <div className="form-actions">
                    <button type="button" className="btn-secondary" onClick={handleClose}>Cancel</button>
                    <button type="submit" className="btn-primary">{billToEdit ? 'Save Changes' : 'Add Bill'}</button>
                </div>
            </form>
        </div>
        </div>
    );
}