import { Component, type ErrorInfo, type ReactNode } from 'react';

interface RemoteErrorBoundaryProps {
  /** Any change to this value clears the caught error and re-renders the children. */
  resetKey: unknown;
  fallback: (error: unknown) => ReactNode;
  onError?: (error: unknown, info: ErrorInfo) => void;
  children: ReactNode;
}

/** The error is wrapped so that a thrown `undefined` still counts as "something was caught". */
interface RemoteErrorBoundaryState {
  caught: { error: unknown } | undefined;
}

/**
 * Headless boundary: it decides *when* to show a fallback, the host decides *what* the fallback
 * looks like. Without one of these around every remote slot, a single remote that throws takes
 * down the host's whole React tree — the host unmounts to a blank page.
 */
export class RemoteErrorBoundary extends Component<
  RemoteErrorBoundaryProps,
  RemoteErrorBoundaryState
> {
  state: RemoteErrorBoundaryState = { caught: undefined };

  static getDerivedStateFromError(error: unknown): RemoteErrorBoundaryState {
    return { caught: { error } };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    this.props.onError?.(error, info);
  }

  componentDidUpdate(previous: RemoteErrorBoundaryProps): void {
    if (this.state.caught && previous.resetKey !== this.props.resetKey) {
      this.setState({ caught: undefined });
    }
  }

  render(): ReactNode {
    const { caught } = this.state;
    return caught ? this.props.fallback(caught.error) : this.props.children;
  }
}
