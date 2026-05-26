import { useState, useEffect } from 'react';
import { interp, resolveTitle } from '../i18n';

const WARM_PALETTE = ['#f3722c', '#f9c74f', '#e8533a', '#FF8C00', '#c44d2e', '#8b5a3c'];
const EXHIBITS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const ROT_PATTERN = [-1, 0.7, -0.6, 1, -0.85, 0.5];

function avatarColor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return WARM_PALETTE[h % WARM_PALETTE.length];
}

function Avatar({ author, size = 48 }) {
  const bg = avatarColor(author);
  const fg = bg === '#f9c74f' ? '#1a0606' : '#fff';
  return (
    <div className="fs-display" style={{
      width: size, height: size, borderRadius: '50%',
      background: bg, color: fg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.42, fontWeight: 800, letterSpacing: '-0.04em',
      flexShrink: 0,
      boxShadow: 'inset 0 -3px 0 rgba(0,0,0,0.28), 0 6px 18px rgba(243,114,44,0.30)',
    }}>
      {author[0].toUpperCase()}
    </div>
  );
}

function highlightNumbers(text) {
  const parts = String(text).split(/(\d[\d,.]*)/g);
  return parts.map((p, i) => {
    if (!/\d/.test(p)) return <span key={i}>{p}</span>;
    return (
      <span key={i} style={{ position: 'relative', display: 'inline-block', color: '#fff', fontWeight: 800, padding: '0 4px', fontSize: '1.18em' }}>
        {p}
        <svg style={{ position: 'absolute', left: '-6px', top: '-5px', pointerEvents: 'none', overflow: 'visible' }} width="44" height="36" viewBox="0 0 44 36" fill="none">
          <path d="M22 4 C 12 4, 4 10, 4 18 C 4 26, 12 32, 22 32 C 32 32, 40 26, 40 18 C 40 12, 34 6, 24 5"
            stroke="#f9c74f" strokeWidth="2.2" strokeLinecap="round" fill="none" transform="rotate(-8 22 18)" />
        </svg>
      </span>
    );
  });
}

export default function RoastMode({ analytics, selectedAuthor, setSelectedAuthor, t, onBack }) {
  const [animKey, setAnimKey] = useState(0);
  const [toast, setToast] = useState(null);

  const u = analytics.userMap[selectedAuthor];
  if (!u) return null;

  const otherUsers = analytics.users.filter(x => x.author !== selectedAuthor);

  useEffect(() => {
    setAnimKey(k => k + 1);
  }, [selectedAuthor]);

  function popToast(msg) {
    setToast(msg);
    clearTimeout(popToast._id);
    popToast._id = setTimeout(() => setToast(null), 1700);
  }

  const rotFor = i => ROT_PATTERN[i % ROT_PATTERN.length] * 0.7;

  return (
    <div className="no-sb" style={{
      height: '100%', overflowY: 'auto', position: 'relative',
      background: 'radial-gradient(ellipse at top right, #2a0a1a 0%, #0a0a0f 60%)',
    }}>
      {/* Atmosphere blobs */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: -90, right: -90, width: 240, height: 240, borderRadius: '50%', background: '#f3722c', opacity: 0.18, filter: 'blur(78px)' }} />
        <div style={{ position: 'absolute', top: 380, left: -90, width: 220, height: 220, borderRadius: '50%', background: '#f9c74f', opacity: 0.10, filter: 'blur(76px)' }} />
        <div style={{ position: 'absolute', bottom: -80, right: -60, width: 220, height: 220, borderRadius: '50%', background: '#e8533a', opacity: 0.16, filter: 'blur(72px)' }} />
      </div>

      <div style={{ position: 'relative', padding: '22px 18px 28px', zIndex: 1 }}>

        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <button onClick={onBack} className="press" style={{
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)',
            color: '#fff', padding: '8px 14px', borderRadius: 999,
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
            backdropFilter: 'blur(8px)',
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            {t.rm_back}
          </button>
          <div className="fs-mono" style={{
            fontSize: 10, color: '#1a0606',
            letterSpacing: '0.24em', fontWeight: 800, textTransform: 'uppercase',
            border: '1.5px solid #f9c74f', padding: '5px 9px 4px',
            borderRadius: 4, background: '#f9c74f',
            transform: 'rotate(-2deg)',
            boxShadow: '0 4px 12px rgba(249,199,79,0.40)',
          }}>
            The Receipts
          </div>
        </div>

        {/* HERO */}
        <div key={`hero-${animKey}`} className="a-fade-up" style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <Avatar author={u.author} size={64} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="fs-display" style={{
              fontSize: 44, lineHeight: 0.94, letterSpacing: '-0.045em',
              fontWeight: 800, color: '#fff',
            }}>
              <span style={{ fontStyle: 'italic' }}>{u.author}</span>
              <span style={{ color: '#f3722c' }}>.</span>
            </div>
            <div className="fs-mono" style={{
              fontSize: 12, color: 'rgba(255,255,255,0.60)',
              marginTop: 6, fontStyle: 'italic',
            }}>
              "{resolveTitle(u, t)}" · {u.roasts.length} exhibits filed
            </div>
          </div>
        </div>

        {/* STAT STRIP */}
        <div style={{ marginTop: 10, display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }} className="no-sb">
          {[
            { label: 'Msgs', value: u.messageCount.toLocaleString() },
            { label: 'Peak', value: `${u.peakHour}:00` },
            { label: 'Night', value: `${u.nightPct}%` },
            { label: 'Streak', value: `${u.longestStreak}d` },
            u.avgRespMin != null && { label: 'Reply', value: u.avgRespMin < 60 ? `${Math.round(u.avgRespMin)}m` : `${(u.avgRespMin / 60).toFixed(1)}h` },
          ].filter(Boolean).map((s, i) => (
            <div key={i} style={{
              flexShrink: 0, padding: '6px 10px',
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 999, color: 'rgba(255,255,255,0.65)',
              fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
              letterSpacing: '0.12em', textTransform: 'uppercase',
              display: 'flex', alignItems: 'baseline', gap: 6,
              backdropFilter: 'blur(6px)',
            }}>
              <span style={{ opacity: 0.7 }}>{s.label}</span>
              <span style={{ color: '#fff', fontWeight: 800 }}>{s.value}</span>
            </div>
          ))}
        </div>

        {/* ROAST CARDS */}
        <div key={`cards-${animKey}`} style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {u.roasts.map((roast, i) => {
            const line = interp(t[roast.lineKey] || '', roast.vars || {});
            const kicker = interp(t[roast.kickerKey] || '', roast.vars || {});
            return (
              <div key={`${selectedAuthor}-${i}`} className="a-roast-card" style={{
                position: 'relative', overflow: 'hidden',
                background: 'radial-gradient(circle at 100% 0%, #3a1812 0%, #1a0606 60%)',
                color: '#fff', borderRadius: 24, padding: '26px 24px 24px',
                border: '1px solid rgba(243,114,44,0.24)',
                boxShadow: '0 22px 50px -14px rgba(0,0,0,0.60), 0 0 0 1px rgba(243,114,44,0.10), 0 2px 0 rgba(243,114,44,0.25) inset',
                transform: `rotate(${rotFor(i)}deg)`,
                animationDelay: `${0.08 + i * 0.10}s`,
              }}>
                {/* ambient glow */}
                <div style={{ position: 'absolute', top: -60, right: -60, width: 180, height: 180, borderRadius: '50%', background: '#f3722c', opacity: 0.20, filter: 'blur(60px)', pointerEvents: 'none' }} />

                {/* Exhibit stamp */}
                <div className="fs-mono" style={{
                  position: 'absolute', top: 16, right: 18,
                  fontSize: 10, color: '#f9c74f', letterSpacing: '0.24em', fontWeight: 700, textTransform: 'uppercase',
                  border: '1.5px solid #f9c74f', padding: '4px 8px 3px',
                  borderRadius: 4, transform: 'rotate(6deg)',
                  background: 'rgba(249,199,79,0.10)',
                  boxShadow: '0 4px 12px rgba(249,199,79,0.25)', zIndex: 2,
                }}>
                  Exhibit&nbsp;{EXHIBITS[i] || i + 1}
                </div>

                {/* Handwritten index */}
                <div style={{
                  fontFamily: "'Caveat', cursive",
                  color: '#f9c74f', opacity: 0.7, fontWeight: 600,
                  marginBottom: 10, lineHeight: 1,
                  transform: 'rotate(-3deg)', transformOrigin: 'left center', fontSize: 19,
                }}>
                  N&nbsp;{i + 1}
                </div>

                {/* Setup line */}
                <div className="fs-sans" style={{ fontSize: 15, lineHeight: 1.5, color: 'rgba(255,255,255,0.82)', fontWeight: 500, marginBottom: 8 }}>
                  {highlightNumbers(line)}
                </div>

                {/* Kicker — focal point */}
                <div className="fs-display" dir="auto" style={{
                  fontStyle: 'italic', fontWeight: 800,
                  color: '#f3722c', fontSize: kicker.length > 90 ? 22 : kicker.length > 60 ? 26 : 32,
                  lineHeight: 1.15, letterSpacing: '-0.035em',
                  overflowWrap: 'break-word', wordBreak: 'break-word', hyphens: 'auto',
                }}>
                  {kicker}
                </div>
              </div>
            );
          })}
        </div>

        {/* VERDICT */}
        <div style={{
          marginTop: 26, position: 'relative', overflow: 'hidden',
          background: 'radial-gradient(circle at 0% 0%, #3a1812 0%, #1a0606 60%)',
          borderRadius: 22, padding: '20px 22px 22px',
          border: '1px solid rgba(243,114,44,0.24)',
          boxShadow: '0 22px 50px -14px rgba(0,0,0,0.55), 0 2px 0 rgba(243,114,44,0.25) inset',
          textAlign: 'center',
        }}>
          <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: '#f9c74f', opacity: 0.18, filter: 'blur(60px)', pointerEvents: 'none' }} />
          <div className="fs-mono" style={{ fontSize: 10, color: '#f9c74f', letterSpacing: '0.24em', fontWeight: 800, textTransform: 'uppercase', position: 'relative' }}>
            ✦ Verdict
          </div>
          <div className="fs-display" style={{
            position: 'relative', fontSize: 22, lineHeight: 1.18,
            fontStyle: 'italic', marginTop: 6, color: '#fff', fontWeight: 800, letterSpacing: '-0.02em',
          }}>
            Send this to <span style={{ color: '#f3722c' }}>{selectedAuthor}</span>.
            <br />
            <span style={{ color: 'rgba(255,255,255,0.55)', fontStyle: 'normal', fontSize: 16, fontFamily: 'var(--font-sans)', fontWeight: 500 }}>
              You know you want to.
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'center', position: 'relative' }}>
            <button className="press" onClick={() => popToast('Image saved')} style={{
              padding: '10px 18px', background: '#f3722c', border: 'none',
              borderRadius: 999, cursor: 'pointer', color: '#1a0606',
              fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 13, letterSpacing: '-0.01em',
              boxShadow: '0 6px 0 rgba(0,0,0,0.40), 0 12px 26px -4px rgba(243,114,44,0.55)',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9a2 2 0 0 1 2-2h2.5l1.5-2h6l1.5 2H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <circle cx="12" cy="13" r="3.5" />
              </svg>
              Screenshot
            </button>
            <button className="press" onClick={() => popToast('Link copied')} style={{
              padding: '10px 18px', background: 'transparent', border: '1.5px solid #f9c74f',
              borderRadius: 999, cursor: 'pointer', color: '#f9c74f',
              fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 13, letterSpacing: '-0.01em',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                <polyline points="16 6 12 2 8 6" />
                <line x1="12" y1="2" x2="12" y2="15" />
              </svg>
              Share
            </button>
          </div>
        </div>

        {/* OTHER VICTIMS */}
        {otherUsers.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div className="fs-mono" style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.22em', fontWeight: 700, textTransform: 'uppercase' }}>
                Next defendant
              </div>
              <div className="fs-mono" style={{ fontSize: 10, color: '#f3722c', fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
                {otherUsers.length} pending
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {otherUsers.map(other => (
                <button key={other.author} onClick={() => setSelectedAuthor(other.author)}
                  className="press" style={{
                    width: '100%', textAlign: 'left',
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 12px',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)',
                    borderRadius: 14, cursor: 'pointer', color: '#fff',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
                  }}>
                  <Avatar author={other.author} size={36} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em' }}>{other.author}</div>
                    <div className="fs-mono" style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', marginTop: 2, fontStyle: 'italic' }}>
                      {interp(other.roasts.length === 1 ? t.rm_ready : t.rm_ready_plural, { n: other.roasts.length })}
                    </div>
                  </div>
                  <div className="fs-mono" style={{ fontSize: 10, color: '#f3722c', letterSpacing: '0.18em', fontWeight: 800 }}>
                    ROAST →
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{
          marginTop: 24, textAlign: 'center',
          fontSize: 10, color: 'rgba(255,255,255,0.42)', lineHeight: 1.5,
          fontFamily: 'var(--font-mono)', letterSpacing: '0.06em',
        }}>
          All exhibits drawn from this chat's data.<br />
          Deterministic. Defensible. Devastating.
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'absolute', bottom: 22, left: '50%', transform: 'translateX(-50%)',
          background: '#1a0606', color: '#fff',
          border: '1px solid rgba(243,114,44,0.45)',
          borderRadius: 999, padding: '10px 18px',
          fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
          letterSpacing: '0.14em', textTransform: 'uppercase',
          zIndex: 60, boxShadow: '0 14px 30px rgba(0,0,0,0.55)',
          animation: 'fadeUp 0.25s cubic-bezier(0.16,1,0.3,1) both',
          whiteSpace: 'nowrap',
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
