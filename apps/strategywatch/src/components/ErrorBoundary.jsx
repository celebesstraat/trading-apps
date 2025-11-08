import React from 'react';
import './ErrorBoundary.css';

/**
 * Error Boundary Component
 * Catches JavaScript errors in child components and displays a fallback UI
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(_error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error to monitoring service in production
    this.setState({
      error: error,
      errorInfo: errorInfo
    });

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error caught by boundary:', error, errorInfo);
    }

    // In production, you would send this to a monitoring service
    if (process.env.NODE_ENV === 'production') {
      // Example: Sentry.captureException(error, { extra: errorInfo });
      this.logErrorToService(error, errorInfo);
    }
  }

  logErrorToService = (error, errorInfo) => {
    // Implement your error logging service here
    // For now, we'll just store in sessionStorage for debugging
    try {
      const errorLog = {
        timestamp: new Date().toISOString(),
        error: {
          message: error.message,
          stack: error.stack
        },
        componentStack: errorInfo.componentStack,
        userAgent: navigator.userAgent,
        url: window.location.href
      };

      // Store last 10 errors
      const existingLogs = JSON.parse(sessionStorage.getItem('errorLogs') || '[]');
      existingLogs.unshift(errorLog);
      const recentLogs = existingLogs.slice(0, 10);
      sessionStorage.setItem('errorLogs', JSON.stringify(recentLogs));
    } catch (e) {
      // Fallback if sessionStorage is not available
      console.error('Failed to log error:', e);
    }
  };

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-container">
            <div className="error-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
            </div>

            <h1 className="error-title">Something went wrong</h1>

            <p className="error-message">
              We&apos;re sorry, but something unexpected happened. The trading application encountered an error.
            </p>

            <div className="error-actions">
              <button
                onClick={this.handleRetry}
                className="error-button error-button-primary"
              >
                Try Again
              </button>
              <button
                onClick={this.handleReload}
                className="error-button error-button-secondary"
              >
                Reload Page
              </button>
            </div>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="error-details">
                <summary>Error Details (Development Only)</summary>
                <pre className="error-stack">
                  {this.state.error.toString()}
                  <br />
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}

            <div className="error-support">
              <p>If the problem persists, please check your internet connection and try again.</p>
              <p className="error-build-info">
                Build: {typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'Unknown'} |
                Time: {typeof __BUILD_TIME__ !== 'undefined' ? new Date(__BUILD_TIME__).toLocaleString() : 'Unknown'}
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;