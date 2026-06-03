import { Component, type ReactNode } from 'react';
import { reportError } from '../lib/errors.js';
import { SUPPORT_EMAIL } from '../lib/config.js';

interface State {
  hasError: boolean;
  message?: string;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error) {
    reportError(error.message, error.stack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-cream px-6 text-center">
          <div className="text-5xl">🕊️</div>
          <h1 className="mt-5 font-display text-2xl font-bold">Something went quiet.</h1>
          <p className="mt-2 max-w-md text-sm text-stone-warm">
            We hit an unexpected error and our team has been notified. You can refresh, or reach out and we'll help right away.
          </p>
          <div className="mt-6 flex gap-3">
            <button onClick={() => window.location.reload()} className="btn bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700">
              Refresh the page
            </button>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="btn border border-black/15 px-5 py-2.5 text-sm font-semibold hover:bg-black/5">
              Get help
            </a>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
