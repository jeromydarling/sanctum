import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import { App } from './App.js';
import { AuthProvider } from './lib/auth.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import { installGlobalErrorHandlers } from './lib/errors.js';
import './index.css';

installGlobalErrorHandlers();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <App />
          <Toaster richColors position="top-center" toastOptions={{ className: 'font-sans' }} />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);
