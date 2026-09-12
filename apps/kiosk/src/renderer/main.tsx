import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { installBrowserShim } from './lib/browserShim';
import './styles/index.css';

installBrowserShim();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
