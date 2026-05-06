import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Top-level safety net. Without it, a thrown render error would unmount the
 * entire app and leave the user staring at a blank screen. We capture the
 * error here so they can at least reload, log out, or copy the message
 * when reporting a bug.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface to the dev console — production users will see the message
    // already in the fallback UI and won't have devtools open.
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught an error:', error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div
        role="alert"
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: 32,
          color: 'var(--color-text)',
          background: 'var(--color-bg)',
        }}
      >
        <div
          style={{
            maxWidth: 520,
            background: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border)',
            borderRadius: 12,
            padding: 24,
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
            Something went wrong.
          </div>
          <div style={{ color: 'var(--color-text-muted)', marginBottom: 16 }}>
            The console hit an unexpected error. Reload to recover; if it keeps
            happening, copy the message below when filing a bug.
          </div>
          <pre
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 6,
              padding: 12,
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              color: 'var(--color-danger)',
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
            }}
          >
            {this.state.error.message}
          </pre>
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={this.handleReload}
              style={{
                background: 'var(--color-accent)',
                color: 'var(--color-text-on-accent)',
                border: 'none',
                borderRadius: 6,
                padding: '8px 14px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}
