import React, { Component, ErrorInfo, ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { AuthProvider } from '@/context/AuthContext'
import './index.css'

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error boundary catch:", error, errorInfo);
  }

  public componentDidMount() {
    window.addEventListener('unhandledrejection', this.handlePromiseRejection);
  }

  public componentWillUnmount() {
    window.removeEventListener('unhandledrejection', this.handlePromiseRejection);
  }

  private handlePromiseRejection = (event: PromiseRejectionEvent) => {
    console.error('Unhandled promise rejection caught:', event.reason);
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#F7EEE4] p-6 font-sans">
          <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-lg border border-[#E7E0D4] text-center">
            <h1 className="font-serif text-3xl font-bold text-[#33381C] mb-4">Something went wrong</h1>
            <p className="text-[#5C5C54] text-sm mb-6">
              An unexpected error occurred. Please try reloading the page to restore your session.
            </p>
            <div className="bg-[#F1ECE3] text-[#1D1E19] p-4 rounded-xl text-left text-xs font-mono overflow-auto max-h-40 mb-6 border border-[#E7E0D4]">
              {this.state.error?.toString() || 'Unknown runtime error'}
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-[#33381C] hover:bg-[#262A14] text-white py-3 px-6 rounded-xl font-semibold transition-all shadow-md active:translate-y-0 hover:-translate-y-0.5"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <AuthProvider>
      <App />
    </AuthProvider>
  </ErrorBoundary>
);

