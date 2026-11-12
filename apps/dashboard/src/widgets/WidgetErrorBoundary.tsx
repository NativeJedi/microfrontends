import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Rendered instead of the children after an error; `retry` clears the error and re-renders. */
  fallback: (error: Error, retry: () => void) => ReactNode;
  onRetry: () => void;
}

interface State {
  error: Error | null;
}

/**
 * One boundary per widget. React unmounts the whole subtree a boundary wraps, so the size of that
 * subtree decides what a crash takes down with it: one boundary around the grid would replace every
 * card, one boundary per card replaces only the card that failed.
 *
 * It catches both halves of a widget's life: the import (a promise rejected inside `use()`) and every
 * render after it. Error boundaries do not catch errors thrown in event handlers or in async callbacks
 * outside rendering — those belong to the widget itself.
 */
export default class WidgetErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Iteration 15 sends this to Sentry; a dashboard must not lose the stack of a widget it isolated.
    console.error('Widget failed', error, info.componentStack);
  }

  private readonly retry = () => {
    this.props.onRetry();
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (error) return this.props.fallback(error, this.retry);
    return this.props.children;
  }
}
