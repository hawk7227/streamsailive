'use client';

import React, { ReactNode } from 'react';
import { C } from './tokens';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, retry: () => void) => ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  retry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.retry);
      }

      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            padding: '20px',
            backgroundColor: C.bg2,
            borderRadius: '8px',
            border: `1px solid ${C.red}`,
          }}
        >
          <div
            style={{
              fontSize: '14px',
              fontWeight: 500,
              color: C.red,
              lineHeight: 1.4,
            }}
          >
            Something went wrong
          </div>
          <div
            style={{
              fontSize: '12px',
              color: C.t3,
              lineHeight: 1.4,
              fontFamily: 'monospace',
            }}
          >
            {this.state.error.message}
          </div>
          <button
            onClick={this.retry}
            style={{
              padding: '8px 12px',
              backgroundColor: C.acc,
              color: C.bg,
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 500,
              lineHeight: 1.4,
              alignSelf: 'flex-start',
            }}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
