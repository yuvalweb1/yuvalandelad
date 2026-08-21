// Full-screen loader shown when opening a recap or game mode for a chat large
// enough that the synchronous computeAll() pass is noticeable.
//
// The percentage is driven entirely by the `progress` prop, never by a timer.
// The whole point of this screen is that the main thread is about to be
// blocked by a synchronous pass — no interval, transition or CSS keyframe can
// tick while that happens, so a self-animating ring would just sit at 0% and
// then vanish. handleLoadRecap in App.jsx instead reports where it actually is
// and yields a paint between steps, so each number the user sees is real work
// that finished.
const RADIUS = 36;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function LoadingRecap({ t, progress = 0 }) {
  const pct = Math.max(0, Math.min(100, Math.round(progress)));

  // Caption tracks progress rather than wall-clock, for the same reason.
  const captions = [
    t.loading_big_c1 || 'Counting every message…',
    t.loading_big_c2 || 'Hunting for drama and dead zones…',
    t.loading_big_c3 || 'Crunching the chaos…',
    t.loading_big_c4 || 'Almost there…',
  ];
  const capIdx = Math.min(captions.length - 1, Math.floor((pct / 100) * captions.length));

  return (
    <div style={{
      position: 'relative', height: '100%', overflow: 'hidden',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '32px 28px',
      background: '#faf6f0',
    }}>
      {/* Background blobs matching Parsing/Landing */}
      <div style={{
        position: 'absolute', top: -60, right: -70, width: 230, height: 230,
        borderRadius: '50%', background: '#ffd972', opacity: 0.55,
        filter: 'blur(72px)', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', top: 80, left: -80, width: 200, height: 200,
        borderRadius: '50%', background: '#f06449', opacity: 0.25,
        filter: 'blur(72px)', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: 60, right: -50, width: 200, height: 200,
        borderRadius: '50%', background: '#9cf6f6', opacity: 0.50,
        filter: 'blur(68px)', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: -40, left: -40, width: 180, height: 180,
        borderRadius: '50%', background: '#f1e4f3', opacity: 0.70,
        filter: 'blur(60px)', pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', zIndex: 10, textAlign: 'center' }}>
        <div style={{ position: 'relative', width: 84, height: 84, margin: '0 auto' }}>
          <svg width="84" height="84" viewBox="0 0 84 84" style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
            <circle cx="42" cy="42" r={RADIUS} fill="none" stroke="rgba(87,50,128,0.15)" strokeWidth="7" />
            <circle
              cx="42" cy="42" r={RADIUS} fill="none"
              stroke="#f06449" strokeWidth="7" strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - pct / 100)}
            />
          </svg>
          <div className="fs-mono" style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 17, fontWeight: 800, color: '#2a0645',
          }}>
            {pct}%
          </div>
        </div>
        <div className="fs-display a-fade-up" style={{
          fontSize: 23, fontWeight: 800, color: '#2a0645', marginTop: 22,
          letterSpacing: '-0.02em',
        }}>
          {t.loading_big_title || 'This one’s a big chat…'}
        </div>
        <div key={capIdx} className="fs-mono a-fade-in" style={{
          fontSize: 12.5, color: '#573280', marginTop: 8, letterSpacing: '0.06em',
          opacity: 0.7, fontWeight: 700, textTransform: 'uppercase',
        }}>
          {captions[capIdx]}
        </div>
      </div>
    </div>
  );
}
