// Placeholder view — UI will be designed later. Reachable from PostMenu.
export default function ChaosTimeline({ t, onBack }) {
  return (
    <div className="no-sb" style={{
      height: '100%', overflowY: 'auto', background: '#F4ECFF',
      display: 'flex', flexDirection: 'column', padding: '24px 20px 28px',
    }}>
      <button onClick={onBack} className="press" style={{
        alignSelf: 'flex-start', background: '#fff', border: '2px solid rgba(131,56,236,0.35)',
        color: '#4A0E4E', padding: '8px 14px', borderRadius: 999, cursor: 'pointer',
        fontSize: 13, fontWeight: 700,
        boxShadow: '0 4px 0 rgba(131,56,236,0.22)',
      }}>
        {t.rm_back || '← Back'}
      </button>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 14 }}>
        <div style={{ fontSize: 72, lineHeight: 1 }}>🌪️</div>
        <div className="fs-display" style={{
          fontSize: 32, fontWeight: 800, color: '#4A0E4E', letterSpacing: '-0.03em',
        }}>
          {t.tz_chaos || 'The chaos timeline'}
        </div>
        <div className="fs-mono" style={{
          fontSize: 13, color: 'rgba(74,14,78,0.55)', fontStyle: 'italic',
          maxWidth: 260,
        }}>
          {t.chaos_coming_soon || 'Coming soon.'}
        </div>
      </div>
    </div>
  );
}
