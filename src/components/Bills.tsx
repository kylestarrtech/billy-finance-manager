import { useState } from 'react';
import { useFinance, type Bill } from '../context/FinanceContext';
import { getFrequencyBreakdown, normalizeToMonthly, getNextPaymentDetails } from '../utils/financeHelpers';
import AddBill from './AddBill';

export default function Bills() {
    const { bills, deleteBill } = useFinance();
    const [editingBill, setEditingBill] = useState<Bill | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isCondensed, setIsCondensed] = useState(false);

    const filteredBills = bills.filter(bill => 
        bill.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const sortedBills = [...filteredBills].sort((a, b) => 
        normalizeToMonthly(b.cost, b.frequency) - normalizeToMonthly(a.cost, a.frequency)
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <h2 style={{ margin: 0 }}>Bills</h2>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <input 
                        type="text" 
                        placeholder="Search bills..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #444', background: '#111', color: 'var(--text-main)' }}
                    />
                    <label className="desktop-only" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                        <input 
                            type="checkbox" 
                            checked={isCondensed} 
                            onChange={(e) => setIsCondensed(e.target.checked)}
                        />
                        Condensed View
                    </label>
                </div>
            </div>

            {sortedBills.length === 0 ? (
                <p style={{ color: '#aaaaaa'}}>No bills found.</p>
            ) : (
                sortedBills.map(bill => {
                    const breakdown = getFrequencyBreakdown(bill.cost, bill.frequency);
                    const details = getNextPaymentDetails(bill);
                    return (
                        <div key={bill.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <h3 style={{ margin: '0 0 0.5rem 0' }}>{bill.name} {bill.isFinanced ? '(Financed)' : ''}</h3>
                                    <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                                        ${bill.cost.toFixed(2)} / {bill.frequency}
                                        <span style={{ marginLeft: '1rem', fontSize: '0.9em' }}>
                                            (~${breakdown.monthly.toFixed(2)}/mo)
                                        </span>
                                    </p>
                                    <p style={{ margin: '0.5rem 0 0 0', color: 'var(--text-main)', fontSize: '0.95em' }}>
                                        <strong>Next Payment:</strong> {details.nextDate.toLocaleDateString()}
                                    </p>
                                    {bill.isFinanced && (
                                        <p style={{ margin: '0.5rem 0 0 0', color: 'var(--color-loss)', fontSize: '0.95em' }}>
                                            <strong>Financed:</strong> ${details.remainingBalance.toFixed(2)} remaining ({details.paymentsLeft} payments left of {bill.loanTermMonths})
                                        </p>
                                    )}
                                    {bill.note && <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9em', fontStyle: 'italic' }}>Note: {bill.note}</p>}
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button className="btn-secondary" onClick={() => setEditingBill(bill)}>Edit</button>
                                    <button className="btn-danger" onClick={() => deleteBill(bill.id)}>Delete</button>
                                </div>
                            </div>

                            {!isCondensed && (
                                <div className="breakdown-container">
                                    <table className="breakdown-table">
                                        <thead>
                                            <tr>
                                                <th>Daily</th>
                                                <th>Weekly</th>
                                                <th>Bi-Weekly</th>
                                                <th>Monthly</th>
                                                <th>Quarterly</th>
                                                <th>Semi-Annually</th>
                                                <th>Annually</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr>
                                                <td>${breakdown.daily.toFixed(2)}</td>
                                                <td>${breakdown.weekly.toFixed(2)}</td>
                                                <td>${breakdown.biweekly.toFixed(2)}</td>
                                                <td>${breakdown.monthly.toFixed(2)}</td>
                                                <td>${breakdown.quarterly.toFixed(2)}</td>
                                                <td>${breakdown.semiannually.toFixed(2)}</td>
                                                <td>${breakdown.annually.toFixed(2)}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    );
                })
            )}

            {editingBill && (
                <AddBill onClose={() => setEditingBill(null)} billToEdit={editingBill} />
            )}
        </div>
    );
}