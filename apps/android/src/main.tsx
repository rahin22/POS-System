import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';
import { initializeCapacitor } from './lib/capacitor';

// Initialize Capacitor plugins
initializeCapacitor();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
