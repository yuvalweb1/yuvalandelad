import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error('ChatWrapped error:', error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: '100vh', background: '#0a0a0f', color: '#f4f4f8',
          padding: 24, fontFamily: 'monospace', fontSize: 23,
        }}>
          <div style={{ color: '#f3722c', fontWeight: 700, marginBottom: 12 }}>
            ChatWrapped hit an unexpected error.
          </div>
          <div style={{ marginBottom: 6 }}>{String(this.state.error)}</div>
          <div style={{ color: '#c8c8dc', marginTop: 12 }}>
            {this.state.error?.stack?.slice(0, 800)}
          </div>
          <button onClick={() => this.setState({ error: null })} style={{
            marginTop: 20, padding: '8px 14px', background: '#f9c74f',
            color: '#0a0a0f', border: 'none', borderRadius: 8, cursor: 'pointer',
          }}>Try again</button>
        </div>
      );
    }
    return this.props.children;
  }
}
