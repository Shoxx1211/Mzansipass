// src/index.tsx
// Pulse Transit - Application Entry Point
// Version: 3.0.0 | Enterprise Release

import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './app/App';

// ======================================================
// PERFORMANCE MONITORING (Production Only)
// ======================================================

// Report web vitals for performance tracking
const reportWebVitals = (metric: any) => {
  // Send to analytics in production
  if (process.env['NODE_ENV'] === 'production') {
    console.log('[Web Vitals]', metric.name, metric.value);
    
    // You can send to Google Analytics, Sentry, etc.
    // Example: ga.sendEvent('web_vitals', { metric_name: metric.name, value: metric.value })
  }
};

// ======================================================
// ERROR BOUNDARY (Prevents app crashes)
// ======================================================

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Application Error:', error, errorInfo);
    
    // Log to error tracking service in production
    if (process.env['NODE_ENV'] === 'production') {
      // Example: Sentry.captureException(error)
    }
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-black flex items-center justify-center p-4">
          <div className="glass rounded-3xl p-8 max-w-md text-center space-y-4">
            <div className="text-6xl">⚠️</div>
            <h1 className="text-2xl font-bold text-white">Something went wrong</h1>
            <p className="text-white/60 text-sm">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 text-white font-bold"
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// ======================================================
// PROGRESSIVE WEB APP (PWA) REGISTRATION
// ======================================================

// Register service worker for offline support (optional)
if ('serviceWorker' in navigator && process.env['NODE_ENV'] === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .then((registration) => {
        console.log('SW registered: ', registration);
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}

// ======================================================
// APP INITIALIZATION
// ======================================================

// Add performance marks
if (process.env['NODE_ENV'] === 'development') {
  performance.mark('app-start');
}

// Get root element
const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Failed to find root element');
}

// Create root and render
const root = ReactDOM.createRoot(rootElement);

// Render app with error boundary
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

// ======================================================
// PERFORMANCE MARKING (Development)
// ======================================================

if (process.env['NODE_ENV'] === 'development') {
  performance.mark('app-mounted');
  performance.measure('app-startup', 'app-start', 'app-mounted');
  
  // Log startup time
  const measurements = performance.getEntriesByType('measure');
  const startupTime = measurements.find(m => m.name === 'app-startup');
  if (startupTime) {
    console.log(`🚀 App startup time: ${startupTime.duration.toFixed(2)}ms`);
  }
}

// ======================================================
// EXPORT WEB VITALS (Optional)
// ======================================================

export { reportWebVitals };