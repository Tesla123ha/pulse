import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Called from the error screen's sign-out button. */
  onSignOut: () => void;
}

interface State {
  error: Error | null;
}

/** Shows what went wrong instead of a blank screen when a screen crashes while rendering. */
class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Pulse crashed while rendering', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <main className="screen" style={{ minHeight: '100vh', justifyContent: 'center' }} role="alert">
        <h1 className="t-title-md">Pulse hit an error</h1>
        <p className="t-secondary">Reload to try again. If it keeps happening, send this message to support:</p>
        <pre className="crash-message">{error.message || String(error)}</pre>
        <button type="button" className="crash-button crash-button--primary" onClick={() => window.location.reload()}>
          Reload
        </button>
        <button type="button" className="crash-button" onClick={this.props.onSignOut}>
          Sign out
        </button>
      </main>
    );
  }
}

export default ErrorBoundary;
