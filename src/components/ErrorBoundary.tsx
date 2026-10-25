import React, { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Shield } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Aegis C2 Recovery] Uncaught UI exception:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#040711] text-slate-100 flex items-center justify-center p-4">
          <div className="max-w-md w-full glass-panel p-6 rounded-2xl border border-red-500/50 bg-[#060b17] shadow-2xl text-center space-y-4">
            <div className="p-3 rounded-xl bg-red-950/80 border border-red-500 text-red-400 inline-block">
              <AlertTriangle className="w-8 h-8 animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-rajdhani font-bold text-white tracking-wider">
                AEGIS COMMAND SUBSYSTEM RECOVERY
              </h2>
              <p className="text-xs font-mono text-slate-400 mt-1">
                A rendering anomaly was isolated. System self-healing active.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-black/60 border border-slate-800 text-left text-xs font-mono text-red-300 max-h-32 overflow-y-auto">
              {this.state.error?.message || 'Unknown runtime error'}
            </div>

            <button
              onClick={this.handleReset}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-black font-rajdhani font-bold text-sm tracking-wider flex items-center justify-center gap-2 shadow"
            >
              <RefreshCw className="w-4 h-4" />
              <span>RESTART COMMAND CENTER</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
