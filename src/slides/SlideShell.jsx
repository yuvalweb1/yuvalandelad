import React from 'react';

const SlideShell = React.memo(function SlideShell({ children, bg, accent = '#f9c74f', shake = false }) {
  return (
    <div className={shake ? 'a-shake' : ''} style={{
      position: 'absolute', inset: 0, overflow: 'hidden', background: 'transparent',
    }}>
      <div style={{
        position: 'absolute', top: -80, right: -80, width: 300, height: 300,
        borderRadius: '50%', background: accent, opacity: 0.22,
        filter: 'blur(90px)', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: -100, left: -80, width: 260, height: 260,
        borderRadius: '50%', background: accent, opacity: 0.12,
        filter: 'blur(90px)', pointerEvents: 'none',
      }} />
      <div className="slide-content" style={{ height: '100%' }}>
        {children}
      </div>
    </div>
  );
})

export default SlideShell;
