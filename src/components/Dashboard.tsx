import { useRef } from 'react';
import { useFinance } from '../context/FinanceContext';
import { getSummaryStats, getUpcomingBills, normalizeToMonthly } from '../utils/financeHelpers';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#ff7300'];

export default function Dashboard() {
    const { bills, incomes, exportData, importData } = useFinance();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (window.confirm('WARNING: Importing data will OVERWRITE all your current bills and income data. Do you wish to proceed?')) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const result = event.target?.result;
                if (typeof result === 'string') {
                    importData(result);
                }
            };
            reader.readAsText(file);
        }

        // Reset the file input so the same file could potentially be imported again
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const stats = getSummaryStats(bills, incomes);
    const upcoming = getUpcomingBills(bills);

    const isNetPositive = stats.leftoverCash >= 0;

    const incomeData = incomes.map(inc => ({
        name: inc.name,
        value: normalizeToMonthly(inc.amount, inc.frequency)
    }));

    const expenseData = bills.map(b => ({
        name: b.name,
        value: normalizeToMonthly(b.cost, b.frequency)
    }));

    const hasData = bills.length > 0 || incomes.length > 0;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            
            {!hasData && (
                <div className="card" style={{ textAlign: 'center', borderColor: 'var(--color-gain)', background: '#22222280' }}>
                    <h2 style={{ margin: '0 0 1rem 0' }}>Welcome to Billy Bill Manager!</h2>
                    <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                        To get started and activate your dashboard metrics, please add your first income source or bill up top.
                    </p>
                </div>
            )}

            {hasData && (
                <>
                {/* Top: Upcoming Expenses */}
                <div className="card">
                    <h2>Upcoming Expenses</h2>
                {upcoming.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)' }}>No upcoming bills.</p>
                ) : (
                    <div className="upcoming-expenses-container">
                        {upcoming.map((u, i) => (
                            <div key={i} className="card" style={{ padding: '1rem', background: '#2a2a2a40' }}>
                                <h4 style={{ margin: '0 0 0.5rem 0' }}>{u.bill.name}</h4>
                                <p style={{ margin: 0, fontWeight: 'bold' }}>${u.bill.cost.toFixed(2)}</p>
                                <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9em', color: 'var(--text-muted)' }}>
                                    Due: {u.nextDate.toLocaleDateString()}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Middle: Key Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '1.5rem' }}>
                <div className="card">
                    <h3>Monthly Income</h3>
                    <h2 style={{ fontSize: '2.5rem', margin: '0.5rem 0', color: 'var(--color-gain)' }}>
                        ${stats.totalMonthlyIncome.toFixed(2)}
                    </h2>
                    <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                        Weekly Avg: ${stats.weeklyIncome.toFixed(2)}
                    </p>
                    <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                        Daily Avg: ${stats.dailyIncome.toFixed(2)}
                    </p>
                </div>

                <div className="card">
                    <h3>Monthly Expenses</h3>
                    <h2 style={{ fontSize: '2.5rem', margin: '0.5rem 0', color: 'var(--color-loss)' }}>
                        ${stats.totalMonthlyExpenses.toFixed(2)}
                    </h2>
                    <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                        Weekly Avg: ${stats.weeklyExpenses.toFixed(2)}
                    </p>
                    <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                        Daily Avg: ${stats.dailyExpenses.toFixed(2)}
                    </p>
                </div>

                <div className={`card ${isNetPositive ? 'outline-gain' : 'outline-loss'}`}>
                    <h3>Remaining</h3>
                    <h2 style={{ fontSize: '2.5rem', margin: '0.5rem 0', color: isNetPositive ? 'var(--color-gain)' : 'var(--color-loss)' }}>
                        {isNetPositive ? '+' : '-'}${Math.abs(stats.leftoverCash).toFixed(2)}
                    </h2>
                    <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                        {isNetPositive ? 'You are cash-positive this month.' : 'You are spending more than you earn!'}
                    </p>
                </div>
            </div>

            {/* Bottom: Charts & Recommendations */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))', gap: '1.5rem' }}>
                    
                    {/* 40/30/30 Split Recommendation */}
                    <div className="card">
                        <h3>Savings Recommendation (40/30/30)</h3>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Based on your total normalized monthly income.</p>
                        
                        <div style={{ marginBottom: '1rem' }}>
                            <h4 style={{ margin: '0 0 0.25rem 0' }}>Needs (40%)</h4>
                            <p style={{ margin: 0, color: 'var(--text-muted)' }}>Recommended: ${(stats.totalMonthlyIncome * 0.40).toFixed(2)}</p>
                            <p style={{ margin: 0, color: 'var(--text-muted)' }}>Actual Essential: ${(stats.essentialExpenses).toFixed(2)}</p>
                        </div>

                        <div style={{ marginBottom: '1rem' }}>
                            <h4 style={{ margin: '0 0 0.25rem 0' }}>Wants (30%)</h4>
                            <p style={{ margin: 0, color: 'var(--text-muted)' }}>Recommended Limit: ${(stats.totalMonthlyIncome * 0.30).toFixed(2)}</p>
                            <p style={{ margin: 0, color: 'var(--text-muted)' }}>Actual Non-essential: ${(stats.totalMonthlyExpenses - stats.essentialExpenses).toFixed(2)}</p>
                        </div>

                        <div>
                            <h4 style={{ margin: '0 0 0.25rem 0' }}>Savings/Investing (30%)</h4>
                            <p style={{ margin: 0, color: 'var(--text-muted)' }}>Recommended Goal: ${(stats.totalMonthlyIncome * 0.30).toFixed(2)}</p>
                            <p style={{ margin: 0, color: 'var(--text-muted)' }}>Actual Leftover: ${(stats.leftoverCash).toFixed(2)}</p>
                        </div>
                    </div>

                    {/* Pie Charts */}
                    <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                        <h3>Cash Flow Breakdown</h3>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', flex: 1 }}>
                            <div style={{ flex: '1 1 200px', height: '250px' }}>
                                <h4 style={{ textAlign: 'center', margin: '0.5rem 0' }}>Income</h4>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={incomeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={false}>
                                            {incomeData.map((_, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(value: any) => `$${Number(value).toFixed(2)}`} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div style={{ flex: '1 1 200px', height: '250px' }}>
                                <h4 style={{ textAlign: 'center', margin: '0.5rem 0' }}>Expenses</h4>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={expenseData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={false}>
                                            {expenseData.map((_, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(value: any) => `$${Number(value).toFixed(2)}`} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                </div>
                </>
            )}

            <div className="desktop-only" style={{ marginTop: 'auto', paddingTop: '2rem', display: 'flex', justifyContent: 'center', gap: '1rem' }}>
                <input 
                    type="file" 
                    accept=".json" 
                    style={{ display: 'none' }} 
                    ref={fileInputRef} 
                    onChange={handleImportFile} 
                />
                <button className="btn-secondary" onClick={() => fileInputRef.current?.click()}>Import Data from JSON</button>
                <button className="btn-secondary" onClick={exportData}>Export Data to JSON</button>
            </div>
            
        </div>
    );
}