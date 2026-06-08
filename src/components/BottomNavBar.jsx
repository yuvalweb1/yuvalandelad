const IconHome = ({ active }) => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 11l9-8 9 8" />
    <path d="M5 10v10a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-5h2v5a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V10" />
  </svg>
);

const IconModes = ({ active }) => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4z" />
    <path d="M5 16.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1L2 19.5l2.1-.9z" />
  </svg>
);

// Muted purple-gray for the resting state — present but not competing for
// attention; a soft pastel-pink pill (not solid brand pink) marks the active tab.
const INACTIVE_INK = '#A99CC0';
const ACTIVE_INK = '#4A0E4E';
const ACTIVE_PILL = 'rgba(255, 24, 103, 0.13)';

function NavTab({ active, label, icon, onClick }) {
  return (
    <button onClick={onClick} className="press" aria-pressed={active} style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 2, padding: '6px 4px',
      background: 'transparent', border: 'none', cursor: 'pointer',
      color: active ? ACTIVE_INK : INACTIVE_INK,
      transition: 'color 0.2s ease-out',
    }}>
      <div aria-hidden style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 42, height: 25, borderRadius: 12,
        background: active ? ACTIVE_PILL : 'transparent',
        transition: 'background 0.2s ease-out',
      }}>
        {icon}
      </div>
      <span className="fs-mono" style={{
        fontSize: 9.5, fontWeight: active ? 600 : 500, letterSpacing: '0.07em',
        textTransform: 'uppercase',
      }}>{label}</span>
    </button>
  );
}

export default function BottomNavBar({ active, onHome, onModes, t }) {
  return (
    <div role="tablist" aria-label={t.nav_home || 'Navigation'} style={{
      position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 45,
      display: 'flex', alignItems: 'stretch',
      background: 'rgba(255,255,255,0.90)',
      backdropFilter: 'blur(14px)',
      borderTop: '1px solid rgba(74,14,78,0.07)',
      borderTopLeftRadius: 18, borderTopRightRadius: 18,
      boxShadow: '0 -2px 16px -4px rgba(74,14,78,0.10)',
      paddingBottom: 16,
      overflow: 'hidden',
    }}>
      <NavTab
        active={active === 'home'}
        label={t.nav_home || 'Home'}
        icon={<IconHome active={active === 'home'} />}
        onClick={onHome}
      />
      <div aria-hidden style={{ width: 1, alignSelf: 'center', height: 22, background: 'rgba(74,14,78,0.08)' }} />
      <NavTab
        active={active === 'modes'}
        label={t.nav_modes || 'Modes'}
        icon={<IconModes active={active === 'modes'} />}
        onClick={onModes}
      />
    </div>
  );
}
