import './App.css'

import { useState, useEffect } from 'react'
import Dashboard from './components/Dashboard'
import AddBill from './components/AddBill'
import AddIncome from './components/AddIncome'
import Bills from './components/Bills'
import Income from './components/Income'
import PinScreen from './components/PinScreen'
import PrivacyScreen from './components/PrivacyScreen'
import { useFinance } from './context/FinanceContext'

type ViewState = 'dashboard' | 'bills' | 'income' | 'privacy';

function App() {
  const { authStatus } = useFinance();
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');

  // modals
  const [isBillModalOpen, setIsBillModalOpen] = useState(false);
  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Moves subtly to act as parallax
      const x = (e.clientX / window.innerWidth - 0.5) * 15;
      const y = (e.clientY / window.innerHeight - 0.5) * 15;
      document.body.style.backgroundPosition = `${x}px ${y}px`;
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard />;
      case 'bills':
        return <Bills />;
      case 'income':
        return <Income />;
      case 'privacy':
        return <PrivacyScreen />;
      default:
        return <Dashboard />;
    }
  }

  if (authStatus === 'loading') return <h1 style={{color: 'white', position: 'absolute', top: '50px', left: '50px'}}>Loading Vault Status: {authStatus}</h1>;
  if (authStatus === 'locked' || authStatus === 'setup') return <PinScreen />;

  return (
    <>
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0.0025, pointerEvents: 'none', zIndex: -1 }}>
        <img src="/logos/white-svg.svg" alt="" style={{ width: '50vw', minWidth: '300px' }} />
      </div>

      <div className="app-container">
        <header className="app-header">
          <div className="header-left">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <img src="/logos/white-svg.svg" alt="Billy Logo" style={{ height: '36px', width: 'auto' }} />
            <h1 style={{ margin: 0 }}>Billy: Bill Management</h1>
          </div>
          <nav className="tab-nav">

            <button
              className={currentView === 'dashboard' ? 'active-tab' : ''}
              onClick={() => setCurrentView('dashboard')}
              >
                Dashboard
              </button>

            <button
              className={currentView === 'bills' ? 'active-tab' : ''}
              onClick={() => setCurrentView('bills')}
              >
                Bills
              </button>

            <button
              className={currentView === 'income' ? 'active-tab' : ''}
              onClick={() => setCurrentView('income')}
              >
                Income
              </button>

            <button
              className={currentView === 'privacy' ? 'active-tab' : ''}
              onClick={() => setCurrentView('privacy')}
              >
                Privacy
              </button>
          </nav>
        </div>
        
        <div className="header-actions">
            <button onClick={() => setIsBillModalOpen(true)}>
              + Bill
            </button>
            
            <button onClick={() => setIsIncomeModalOpen(true)}>
              + Income
            </button>
        </div>
      </header>

      <main key={currentView} className="app-main">
        {renderView()}
      </main>

      {isBillModalOpen && (
        <AddBill onClose={() => setIsBillModalOpen(false)} />
      )}

      {isIncomeModalOpen && (
        <AddIncome onClose={() => setIsIncomeModalOpen(false)} />
      )}
    </div>
    </>
  )
}

export default App