export default function BottomSheet({ children, onClose, title = 'Switch person' }) {
  return (
    <>
      <div onClick={onClose} style={{
        position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 60,
      }} />
      <div className="no-sb" style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        overflowY: 'auto', background: '#0a0a0f',
        borderRadius: '24px 24px 0 0', zIndex: 61,
        maxHeight: '70%', padding: '12px 18px 32px',
        borderTop: '1px solid #2a2a36',
        animation: 'fadeUp 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)',
      }}>
        <div style={{
          margin: '0 auto 16px',
          width: 36, height: 4, background: '#2a2a36', borderRadius: 999,
        }} />
        <div className="fs-display" style={{
          fontSize: 22, letterSpacing: '-0.02em', marginBottom: 8,
        }}>
          {title}
        </div>
        {children}
      </div>
    </>
  );
}
