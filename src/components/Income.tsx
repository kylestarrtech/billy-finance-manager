import { useState } from 'react';
import { useFinance, type Income as IncomeType } from '../context/FinanceContext';
import { getFrequencyBreakdown, normalizeToMonthly } from '../utils/financeHelpers';
import AddIncome from './AddIncome';

export default function Income() {
    const { incomes, deleteIncome } = useFinance();
    const [editingIncome, setEditingIncome] = useState<IncomeType | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isCondensed, setIsCondensed] = useState(false);

    const filteredIncomes = incomes.filter(income => 
        income.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const sortedIncomes = [...filteredIncomes].sort((a, b) => 
        normalizeToMonthly(b.amount, b.frequency) - normalizeToMonthly(a.amount, a.frequency)
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <h2 style={{ margin: 0 }}>Income ({incomes.length})</h2>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <input 
                        type="text" 
                        placeholder="Search income..." 
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

            {sortedIncomes.length === 0 ? (
                <p style={{ color: '#aaaaaa'}}>No income sources found.</p>
            ) : (
                sortedIncomes.map(income => {
                    const breakdown = getFrequencyBreakdown(income.amount, income.frequency);
                    return (
                        <div key={income.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <h3 style={{ margin: '0 0 0.5rem 0' }}>{income.name}</h3>
                                    <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                                        ${income.amount.toFixed(2)} / {income.frequency}
                                        <span style={{ marginLeft: '1rem', fontSize: '0.9em' }}>
                                            (~${breakdown.monthly.toFixed(2)}/mo)
                                        </span>
                                    </p>
                                    {income.endingPaymentDate && <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9em', fontStyle: 'italic' }}>Ends on: {income.endingPaymentDate}</p>}
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button className="btn-secondary" onClick={() => setEditingIncome(income)}>Edit</button>
                                    <button className="btn-danger" onClick={() => deleteIncome(income.id)}>Delete</button>
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

            {editingIncome && (
                <AddIncome onClose={() => setEditingIncome(null)} incomeToEdit={editingIncome} />
            )}
        </div>
    );
}