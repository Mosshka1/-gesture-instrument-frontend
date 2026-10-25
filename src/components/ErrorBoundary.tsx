import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

type State = { failed: boolean };

class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('UI crashed', error, info);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center' }}>
        <div>
          <h2 style={{ marginBottom: 8 }}>Щось пішло не так</h2>
          <p style={{ color: 'var(--muted)', marginBottom: 18 }}>Сторінка зламалась. Спробуй оновити — зазвичай цього досить.</p>
          <button className="btn primary" onClick={() => window.location.reload()}>
            Оновити сторінку
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
