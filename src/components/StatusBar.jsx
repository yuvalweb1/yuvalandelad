export default function StatusBar() {
  return (
    <div className="fs-mono" style={{
      flexShrink: 0, position: 'relative', display: 'flex',
      alignItems: 'center', justifyContent: 'space-between',
      padding: '0 28px', height: 40, fontSize: 22, fontWeight: 600, zIndex: 50,
    }}>
      <span>9:41</span>
      <div style={{
        position: 'absolute', left: '50%', transform: 'translateX(-50%)',
        top: 6, width: 90, height: 26, background: '#000', borderRadius: 999,
      }} />
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <svg width="15" height="9" viewBox="0 0 16 10" fill="currentColor">
          <rect x="0" y="7" width="2.5" height="3" rx="0.5"/>
          <rect x="4" y="5" width="2.5" height="5" rx="0.5"/>
          <rect x="8" y="3" width="2.5" height="7" rx="0.5"/>
          <rect x="12" y="0.5" width="2.5" height="9.5" rx="0.5"/>
        </svg>
        <svg width="24" height="10" viewBox="0 0 26 11" fill="none">
          <rect x="0.5" y="0.5" width="22" height="10" rx="2.5" stroke="currentColor" opacity="0.5"/>
          <rect x="2" y="2" width="19" height="7" rx="1" fill="currentColor"/>
          <rect x="23" y="3.5" width="2" height="4" rx="1" fill="currentColor" opacity="0.5"/>
        </svg>
      </div>
    </div>
  );
}
