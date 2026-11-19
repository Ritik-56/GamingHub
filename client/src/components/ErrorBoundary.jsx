import { Component } from 'react';

/**
 * ErrorBoundary — catches render/lifecycle errors in a subtree and shows
 * a fallback instead of crashing the entire application.
 *
 * Usage:
 *   <ErrorBoundary fallback={<p>Something went wrong.</p>}>
 *     <ComponentThatMightFail />
 *   </ErrorBoundary>
 *
 * Or with the default fallback:
 *   <ErrorBoundary>
 *     <ComponentThatMightFail />
 *   </ErrorBoundary>
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Caught error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback !== undefined) {
        return this.props.fallback;
      }
      return (
        <div style={{
          padding: '1rem',
          background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: '10px',
          color: '#f87171',
          fontSize: '0.8125rem',
          textAlign: 'center',
        }}>
          <span style={{ marginRight: '0.5rem' }}>⚠️</span>
          This section failed to load.
        </div>
      );
    }
    return this.props.children;
  }
}
