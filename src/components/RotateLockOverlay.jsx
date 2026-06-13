// Shown only when a touch device is physically rotated to landscape
// (see the .cw-rotate-lock media query in GlobalStyles.jsx). The native
// shells and the PWA manifest already pin the app to portrait, so this
// is the fallback for plain mobile-browser tabs.
export default function RotateLockOverlay({ t }) {
  return (
    <div className="cw-rotate-lock" role="alert">
      <svg
        className="cw-rotate-icon"
        width="56" height="56" viewBox="0 0 24 24" fill="none"
        aria-hidden="true"
      >
        <rect x="7" y="2" width="10" height="20" rx="2" stroke="#00BFFF" strokeWidth="1.5" />
        <line x1="10" y1="19" x2="14" y2="19" stroke="#00BFFF" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <div className="fs-display" style={{ fontSize: 20, fontWeight: 800 }}>
        {t.rotate_title}
      </div>
      <div className="fs-sans" style={{ fontSize: 15, opacity: 0.75, maxWidth: 280, lineHeight: 1.5 }}>
        {t.rotate_body}
      </div>
    </div>
  );
}
