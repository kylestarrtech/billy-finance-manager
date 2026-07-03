import { useState } from 'react';
import { useFinance } from '../context/FinanceContext';

export default function PinScreen() {
    const { authStatus, unlockVault, setupVault, clearAllData } = useFinance();
    const [pin, setPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [error, setError] = useState('');

    const isSetup = authStatus === 'setup';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        
        if (pin.length !== 6 || !/^\d{6}$/.test(pin)) {
            setError('PIN must be exactly 6 digits.');
            return;
        }

        if (isSetup) {
            if (pin !== confirmPin) {
                setError('PINs do not match.');
                return;
            }
            await setupVault(pin);
        } else {
            const success = await unlockVault(pin);
            if (!success) {
                setError('Incorrect PIN.');
                setPin('');
            }
        }
    };

    const handleForgotPinReset = async () => {
        const confirmed = window.confirm(
            'WARNING: This will permanently delete all encrypted data and remove your PIN. This cannot be undone.\n\nDo you want to continue?'
        );

        if (!confirmed) {
            return;
        }

        await clearAllData();
    };

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
            <div className="card" style={{ width: '100%', maxWidth: '400px', textAlign: 'center', padding: '3rem 2rem', backgroundColor: '#22222230'}}>
                <img src="/logos/white-svg.svg" alt="Billy Logo" style={{ height: '48px', marginBottom: '1.5rem' }} />
                <h2 style={{ margin: '0 0 0.5rem 0' }}>{isSetup ? 'Create a Secure PIN' : 'Enter Your PIN'}</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
                    {isSetup 
                        ? <>
                            This 6-digit PIN will encrypt your data locally.<br />
                            <strong>If you forget it, your data cannot be recovered.</strong>
                          </>
                        : 'Unlock your secure local vault.'}
                </p>
                
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                    <div className="form-group" style={{ width: '100%', maxWidth: '250px', marginBottom: 0 }}>
                        <input 
                            type="password" 
                            maxLength={6} 
                            value={pin} 
                            onChange={e => setPin(e.target.value.replace(/\D/g, ''))} 
                            placeholder="••••••" 
                            style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.5em', fontWeight: 'bold' }}
                            required
                        />
                    </div>

                    {isSetup && (
                        <div className="form-group" style={{ width: '100%', maxWidth: '250px', marginBottom: 0 }}>
                            <input 
                                type="password" 
                                maxLength={6} 
                                value={confirmPin} 
                                onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ''))} 
                                placeholder="••••••" 
                                style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.5em', fontWeight: 'bold' }}
                                required
                            />
                        </div>
                    )}

                    {error && <p style={{ color: 'var(--color-loss)', margin: 0, fontWeight: 'bold' }}>{error}</p>}

                    <button type="submit" className="btn-standard" style={{ width: '100%', maxWidth: '250px', fontSize: '1.1rem', padding: '0.75rem', marginTop: '1rem' }}>
                        {isSetup ? 'Set PIN' : 'Unlock Vault'}
                    </button>

                    {!isSetup && (
                        <button
                            type="button"
                            className="btn-danger"
                            onClick={handleForgotPinReset}
                            style={{ width: '100%', maxWidth: '250px', marginTop: '0.5rem' }}
                        >
                            Wipe My Data (Forgot PIN)
                        </button>
                    )}
                </form>
            </div>
        </div>
    );
}