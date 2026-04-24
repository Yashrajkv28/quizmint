import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Surface the crash in the console so it shows up in Vercel logs if this ever happens in prod.
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  private handleReload = () => {
    window.location.replace('/');
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const message = this.state.error?.message || 'Something broke on our end.';
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--c-app)] text-[var(--c-text)] p-6">
        <div className="max-w-md w-full border border-[var(--c-border)] bg-[var(--c-surface)] rounded-2xl p-6 text-center">
          <h1 className="text-[20px] font-semibold mb-2">That didn’t go to plan</h1>
          <p className="text-[14px] text-[var(--c-text-subtle)] mb-5 break-words">{message}</p>
          <button
            type="button"
            onClick={this.handleReload}
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-[var(--c-brand)] text-white text-[14px] font-medium hover:opacity-90 transition-opacity"
          >
            Reload QuizMint
          </button>
        </div>
      </div>
    );
  }
}
