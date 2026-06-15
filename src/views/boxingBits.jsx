// ============================================================
// Fight-night primitives for Hot Takes. (Heavy boxing-arena skin.)
//
// A committed prize-fight look: a spotlit ring with red/blue corner
// posts and taut ropes, a dark roaring-crowd arena, a ring bell, big
// boxing gloves, a "TALE OF THE TAPE" stat plate, and a KO stamp.
//
// All inline SVG/CSS — no image assets, no network. Layouts use
// logical properties so they mirror cleanly under RTL. The ring is
// left-right symmetric so RED/BLUE corners simply swap sides in RTL
// (still semantically fine: colour is what carries meaning).
// ============================================================

const CROWD    = '#0E0A12';   // arena black
const CROWD2   = '#1A1018';
const MAT       = '#3A2740';   // ring canvas
const MAT_HI    = '#4A3350';
const ROPE      = '#F2C04A';
const POST_R    = '#E23B4E';   // red corner post
const POST_B    = '#3E7CB1';   // blue corner post
const RED        = '#E23B4E';   // red corner = AGREE
const BLUE       = '#3E7CB1';   // blue corner = DISAGREE
const FLAME      = '#F2622E';   // brand accent
const OFFWHITE   = '#F7F1E8';
const GOLD       = '#F2C04A';

// ── The ring under stadium spotlights — a committed full-bleed
//    backdrop: dark crowd, twin spotlights, a perspective canvas with
//    corner posts and three taut ropes. Symmetric → RTL-safe.
export function FightArena({ sweep = false, dim = false }) {
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {/* dark arena + crowd haze */}
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(130% 90% at 50% 6%, ${CROWD2} 0%, ${CROWD} 58%)` }} />
      {/* crowd speckle (cheap dotted texture up top) */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '34%', opacity: 0.5,
        backgroundImage: 'radial-gradient(rgba(247,241,232,0.10) 1px, transparent 1.4px)',
        backgroundSize: '9px 9px',
      }} />
      {/* twin overhead spotlights */}
      <div style={{ position: 'absolute', top: '-18%', left: '24%', width: '60%', height: '70%', background: 'radial-gradient(circle at 50% 0%, rgba(247,241,232,0.16) 0%, transparent 55%)' }} />
      <div style={{ position: 'absolute', top: '-18%', left: '16%', width: '70%', height: '78%', background: 'radial-gradient(circle at 50% 0%, rgba(242,98,46,0.10) 0%, transparent 60%)' }} />
      {/* sweeping key light during suspense */}
      {sweep && (
        <div className="a-ring-sweep" style={{ position: 'absolute', top: 0, bottom: 0, width: '46%', background: 'linear-gradient(90deg, transparent, rgba(242,98,46,0.16), transparent)' }} />
      )}
      {/* the ring */}
      <svg viewBox="0 0 100 78" width="100%" height="100%" preserveAspectRatio="xMidYMax slice" style={{ position: 'absolute', inset: 0 }}>
        {/* canvas (perspective trapezoid) */}
        <polygon points="10,78 90,78 74,40 26,40" fill={MAT} />
        <polygon points="26,40 74,40 73,43 27,43" fill={MAT_HI} />
        {/* centre logo ring */}
        <ellipse cx="50" cy="60" rx="14" ry="5" fill="none" stroke={GOLD} strokeWidth="0.5" opacity="0.35" />
        {/* corner posts: red (left), blue (right) */}
        <rect x="22" y="30" width="3" height="13" rx="1" fill={POST_R} />
        <rect x="75" y="30" width="3" height="13" rx="1" fill={POST_B} />
        <rect x="6"  y="60" width="3.4" height="18" rx="1" fill={POST_R} />
        <rect x="90.6" y="60" width="3.4" height="18" rx="1" fill={POST_B} />
        {/* ropes — three lines each side + front rails */}
        {[0, 1, 2].map(i => {
          const o = 0.85 - i * 0.18;
          const y0 = 31 + i * 3.4;
          const y1 = 61 + i * 5.6;
          return (
            <g key={i}>
              <line x1="23.5" y1={y0} x2="7.7" y2={y1} stroke={ROPE} strokeWidth="0.7" opacity={o} />
              <line x1="76.5" y1={y0} x2="92.3" y2={y1} stroke={ROPE} strokeWidth="0.7" opacity={o} />
              <line x1="23.5" y1={y0} x2="76.5" y2={y0} stroke={ROPE} strokeWidth="0.6" opacity={o * 0.7} />
              <line x1="7.7" y1={y1} x2="92.3" y2={y1} stroke={ROPE} strokeWidth="0.8" opacity={o} />
            </g>
          );
        })}
      </svg>
      {dim && <div style={{ position: 'absolute', inset: 0, background: 'rgba(14,10,18,0.45)' }} />}
    </div>
  );
}

// Back-compat alias.
export const FightRing = ({ sweep }) => <FightArena sweep={sweep} />;

// ── Boxing glove icon (SVG) — tinted per corner, laced. ─────────────
export function Glove({ size = 56, color = RED }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" style={{ display: 'block' }}>
      <path d="M6.6 6.4c0-2.1 1.7-3.6 3.8-3.6s3.6 1.6 3.6 3.7v2.9h1.3c2.1 0 3.5 1.5 3.5 3.6v2.3c0 3-2.6 5.3-5.7 5.3H9.7c-2.9 0-5.1-2.1-5.1-4.9V8.6C4.6 7.2 5.5 6.4 6.6 6.4z" fill={color} />
      <path d="M14 9.4v3.1h-3.2V8.6c0-1 .7-1.6 1.6-1.6s1.6.7 1.6 1.7v.7z" fill="rgba(0,0,0,0.2)" />
      <rect x="6" y="15.4" width="12.2" height="2.2" rx="1.1" fill="rgba(0,0,0,0.24)" />
      <path d="M9 6.6c1-1 3.4-1 4.4 0" stroke="rgba(255,255,255,0.5)" strokeWidth="0.7" fill="none" />
      <circle cx="9.4" cy="6.4" r="0.9" fill="rgba(255,255,255,0.32)" />
    </svg>
  );
}

// ── Ring bell (SVG) — shakes (.a-bell-ring) when a round starts. ────
export function RingBell({ size = 52, ringing = false }) {
  return (
    <div className={ringing ? 'a-bell-ring' : ''} style={{ width: size, height: size, display: 'inline-block' }}>
      <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true">
        <rect x="11" y="2" width="2" height="3" rx="1" fill={GOLD} />
        <path d="M5.5 18c0-5.2 2.6-9.5 6.5-9.5s6.5 4.3 6.5 9.5z" fill={GOLD} />
        <path d="M5.5 18c0-5.2 2.6-9.5 6.5-9.5V18z" fill="rgba(0,0,0,0.18)" />
        <rect x="4" y="18" width="16" height="2.4" rx="1.2" fill="#C99A2E" />
        <circle cx="12" cy="21.6" r="1.6" fill={GOLD} />
        <path d="M3 14c-1 .4-1.6 1.2-1.6 2.2" stroke={GOLD} strokeWidth="0.9" fill="none" opacity="0.7" />
        <path d="M21 14c1 .4 1.6 1.2 1.6 2.2" stroke={GOLD} strokeWidth="0.9" fill="none" opacity="0.7" />
      </svg>
    </div>
  );
}

// ── A "TALE OF THE TAPE" stat plate for the evidence number. ───────
export function TaleOfTape({ label, value, unit, color = FLAME, name, avatar }) {
  return (
    <div style={{
      width: '100%', maxWidth: 340, background: CROWD2,
      border: `3px solid ${color}`, borderRadius: 16, overflow: 'hidden',
      boxShadow: `0 18px 40px -12px rgba(0,0,0,0.7), 0 0 0 1px rgba(247,241,232,0.06)`,
    }}>
      <div className="fs-boxing" style={{
        background: color, color: '#141017', fontSize: 15, letterSpacing: '0.14em',
        padding: '9px 14px', textTransform: 'uppercase', textAlign: 'center',
      }}>{label}</div>
      <div style={{ padding: '20px 16px', textAlign: 'center' }}>
        {avatar && <div style={{ display: 'flex', justifyContent: 'center' }}>{avatar}</div>}
        {name && <div dir="auto" className="fs-sans" style={{ fontWeight: 800, fontSize: 14, marginTop: avatar ? 8 : 0, color: OFFWHITE }}>{name}</div>}
        <div className="fs-boxing a-spring" style={{ fontSize: 'clamp(56px, 19vw, 82px)', lineHeight: 1, marginTop: 6, color }}>{value}</div>
        {unit && <div className="fs-sans" style={{ fontSize: 13, color: 'rgba(247,241,232,0.6)', marginTop: 4 }}>{unit}</div>}
      </div>
    </div>
  );
}

export const BOX = { CROWD, CROWD2, MAT, ROPE, RED, BLUE, FLAME, OFFWHITE, GOLD, POST_R, POST_B };
