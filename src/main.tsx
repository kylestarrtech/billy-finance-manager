import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { FinanceProvider } from './context/FinanceContext.tsx'

window.addEventListener('error', (e) => {
    document.body.innerHTML += `<div style="color:red; background:white; z-index:9999; position:absolute; top:0; left:0; width:100%; padding:10px;">Error: ${e.message} ${e.filename} ${e.lineno}</div>`;
});
window.addEventListener('unhandledrejection', (e) => {
    document.body.innerHTML += `<div style="color:red; background:white; z-index:9999; position:absolute; top:50px; left:0; width:100%; padding:10px;">Unhandled Promise: ${e.reason}</div>`;
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FinanceProvider>
      <App />
    </FinanceProvider>
  </StrictMode>,
)
