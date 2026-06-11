// ============================================================
// ChaosTimeline — "Chaos Mode" presented as a full-screen Story
// deck (same UX vocabulary as Wrapped: progress bar at the top,
// tap-right to advance, tap-left to go back, close in the corner).
//
// Each slide carries a single idea: the seismogram, one award per
// slide, then the top-3 peaks each as their own full-screen card
// with the actual messages from that minute (the hallmark feature
// that the regular Wrapped deck deliberately never does).
//
// Slides skip themselves when they have no data — e.g. capsRiot
// drops out for chats with no shouting.
// ============================================================
import { useMemo, useRef, useState } from 'react';

// ── Palette ────────────────────────────────────────────────────
const CREAM     = '#FFF6D6';
const PINK      = '#FDE6F1';
const EGGPLANT  = '#4A0E4E';
const PLUM      = '#2a0645';
const CORAL     = '#f06449';
const GOLD      = '#FFD700';
const SKY       = '#00BFFF';
const MAGENTA   = '#FF1867';
const VIOLET    = '#573280';
const MINT      = '#43AA8B';
const ROSE      = '#F94144';
const NAVY      = '#0A192F';
const WHITE     = '#fff5f7';
const MUTED     = 'rgba(74,14,78,0.55)';

const PEAK_TITLES = {
  late_night:  { eyebrow: '🌙 LATE NIGHT',  fallback: 'The 3 AM Eruption' },
  morning:     { eyebrow: '☕ MORNING',     fallback: 'The Coffee Riot' },
  midmorning:  { eyebrow: '⏰ MIDMORNING',  fallback: 'The Morning Surge' },
  lunch:       { eyebrow: '🍔 LUNCH',       fallback: 'The Lunch Hour Madness' },
  afternoon:   { eyebrow: '🌞 AFTERNOON',   fallback: 'The Afternoon Storm' },
  evening:     { eyebrow: '🌆 EVENING',     fallback: 'The Evening Riot' },
  late:        { eyebrow: '🌌 NIGHT',       fallback: 'The Late-Night Storm' },
};

const AWARD_THEMES = {
  loudest:   { emoji: '🎤', bg: MAGENTA, fg: '#fff',     accent: GOLD },
  speedRun:  { emoji: '⚡',  bg: GOLD,    fg: EGGPLANT,  accent: CORAL },
  groupRiot: { emoji: '👥', bg: SKY,     fg: '#fff',     accent: GOLD },
  latest:    { emoji: '🌙', bg: VIOLET,  fg: '#fff',     accent: GOLD },
  capsRiot:  { emoji: '📣', bg: CORAL,   fg: '#fff',     accent: GOLD },
  deadZone:  { emoji: '🪦', bg: NAVY,    fg: '#fff',     accent: MINT },
};

// All date formatting goes through the app's active language, not
// the browser locale — otherwise an English UI on an Israeli phone
// gets Hebrew month names sprinkled into the deck.
function formatPeakTime(iso, lang) {
  if (!iso) return '';
  const d = new Date(iso);
  const day = d.toLocaleDateString(lang || 'en', { month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString(lang || 'en', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${day} · ${time}`;
}
function dayOnly(iso, lang) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(lang || 'en', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Shared slide chrome ────────────────────────────────────────
function SlideShell({ bg, children, dark = false }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, overflow: 'hidden',
      background: bg || `linear-gradient(180deg, ${CREAM} 0%, #FFF0E2 46%, ${PINK} 100%)`,
      color: dark ? '#fff' : EGGPLANT,
      display: 'flex', flexDirection: 'column',
      padding: 'calc(env(safe-area-inset-top, 0px) + 56px) 24px calc(env(safe-area-inset-bottom, 0px) + 32px)',
    }}>
      {children}
    </div>
  );
}

function FloatingBlobs({ tint, dark = false }) {
  const op = dark ? 0.32 : 0.45;
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', top: -70, left: -70, width: 240, height: 240, borderRadius: '50%', background: tint, opacity: op, filter: 'blur(72px)' }} />
      <div style={{ position: 'absolute', top: 200, right: -70, width: 220, height: 220, borderRadius: '50%', background: tint, opacity: op * 0.7, filter: 'blur(72px)' }} />
      <div style={{ position: 'absolute', bottom: -60, left: -50, width: 240, height: 240, borderRadius: '50%', background: tint, opacity: op * 0.8, filter: 'blur(68px)' }} />
    </div>
  );
}

// ── Individual slide renderers ─────────────────────────────────

function SlideIntro({ t, chaos }) {
  const total = chaos.seismogram?.length || 0;
  const peakCount = chaos.peaks?.length || 0;
  const STORM = ['⚡', '🔥', '💥', '🌪️', '⚡', '🎤', '🌙', '🚨'];
  const rots = [-12, 8, -6, 14, -10, 5, -3, 9];
  const positions = [
    { top: '8%',  left: '6%'  }, { top: '12%', right: '8%' },
    { top: '28%', right: '14%' }, { top: '40%', left: '4%'  },
    { bottom: '32%', right: '6%' }, { bottom: '20%', left: '10%' },
    { bottom: '8%', right: '18%' }, { top: '60%', left: '46%' },
  ];
  return (
    <SlideShell>
      <FloatingBlobs tint={MAGENTA} />
      {/* Sticker-rain — same sticker pattern as Landing but cranked. */}
      {STORM.map((e, i) => (
        <div key={i} className="a-float" aria-hidden style={{
          position: 'absolute', ...positions[i],
          width: 48, height: 48,
          background: '#fff', borderRadius: 10,
          boxShadow: '0 6px 16px rgba(74,14,78,0.20), 0 1px 3px rgba(74,14,78,0.10)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transform: `rotate(${rots[i]}deg)`,
          animationDelay: `${(i * 0.18) % 1.4}s`,
          zIndex: 1,
        }}>
          <span style={{ fontSize: 26, lineHeight: 1 }}>{e}</span>
        </div>
      ))}
      <div style={{ position: 'relative', zIndex: 2, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div className="fs-mono a-fade-up" style={{
          fontSize: 13, letterSpacing: '0.26em', textTransform: 'uppercase',
          color: CORAL, fontWeight: 800,
        }}>⚡ {t.menu_chaos_eyebrow || 'CHAOS MODE'}</div>
        <div className="fs-display a-fade-up" style={{
          marginTop: 12, fontSize: 'clamp(56px, 16vw, 84px)', fontWeight: 800, color: EGGPLANT,
          letterSpacing: '-0.045em', lineHeight: 0.92,
          textShadow: '0 3px 0 rgba(255,255,255,0.75), 0 2px 4px rgba(74,14,78,0.18), 0 8px 18px rgba(240,100,73,0.25)',
          animationDelay: '0.08s',
        }}>
          {t.chaos_intro_title || 'Buckle up.'}
        </div>
        {/* big stat strip */}
        <div className="a-fade-up" style={{ marginTop: 22, display: 'flex', gap: 10, animationDelay: '0.22s' }}>
          <div style={{
            flex: 1, background: 'rgba(255,255,255,0.85)', borderRadius: 16, padding: '12px 12px',
            border: '2px solid rgba(255,255,255,0.95)',
            boxShadow: '0 5px 0 rgba(74,14,78,0.10), 0 14px 24px -8px rgba(74,14,78,0.20)',
          }}>
            <div className="fs-display" style={{ fontSize: 30, fontWeight: 800, color: EGGPLANT, letterSpacing: '-0.04em', lineHeight: 1 }}>{peakCount}</div>
            <div className="fs-mono" style={{ marginTop: 4, fontSize: 10, fontWeight: 700, color: MUTED, letterSpacing: '0.10em', textTransform: 'uppercase' }}>{t.chaos_unit_peaks || 'peaks'}</div>
          </div>
          <div style={{
            flex: 1, background: 'rgba(255,255,255,0.85)', borderRadius: 16, padding: '12px 12px',
            border: '2px solid rgba(255,255,255,0.95)',
            boxShadow: '0 5px 0 rgba(74,14,78,0.10), 0 14px 24px -8px rgba(74,14,78,0.20)',
          }}>
            <div className="fs-display" style={{ fontSize: 30, fontWeight: 800, color: EGGPLANT, letterSpacing: '-0.04em', lineHeight: 1 }}>{total}</div>
            <div className="fs-mono" style={{ marginTop: 4, fontSize: 10, fontWeight: 700, color: MUTED, letterSpacing: '0.10em', textTransform: 'uppercase' }}>{t.chaos_unit_days || 'days'}</div>
          </div>
        </div>
        <div className="fs-sans a-fade-up" style={{
          marginTop: 20, fontSize: 16, lineHeight: 1.4,
          color: 'rgba(74,14,78,0.70)', fontWeight: 600,
          animationDelay: '0.34s',
        }}>
          {t.chaos_intro_sub_short || 'Every wild minute. Every silence. Every shouting match.'}
        </div>
      </div>
      <div className="fs-mono a-fade-up" style={{
        position: 'relative', zIndex: 2,
        fontSize: 11, textAlign: 'center', color: MUTED, letterSpacing: '0.18em',
        animationDelay: '0.5s',
      }}>{t.chaos_tap || 'TAP TO START →'}</div>
    </SlideShell>
  );
}

function SlideSeismogram({ t, lang, chaos }) {
  const data = chaos.seismogram || [];
  // Re-bucket so we get ~70 bars on a phone width.
  const stride = Math.max(1, Math.ceil(data.length / 70));
  const bars = [];
  for (let i = 0; i < data.length; i += stride) {
    let intensity = 0;
    for (let j = i; j < Math.min(i + stride, data.length); j++) {
      intensity = Math.max(intensity, data[j].intensity);
    }
    bars.push(intensity);
  }
  const firstDay = data[0] ? new Date(data[0].day) : null;
  const lastDay = data[data.length - 1] ? new Date(data[data.length - 1].day) : null;
  const monthLabel = (d) => d?.toLocaleDateString(lang || 'en', { month: 'short', year: '2-digit' }) || '';
  return (
    <SlideShell>
      <FloatingBlobs tint={VIOLET} />
      <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div className="fs-mono a-fade-up" style={{
          fontSize: 12, letterSpacing: '0.22em', textTransform: 'uppercase',
          color: VIOLET, fontWeight: 800,
        }}>🌊 {t.chaos_seismogram_eyebrow || 'THE SEISMOGRAM'}</div>
        <div className="fs-display a-fade-up" style={{
          marginTop: 10, fontSize: 40, fontWeight: 800, color: EGGPLANT,
          letterSpacing: '-0.035em', lineHeight: 1.0,
          textShadow: '0 2px 0 rgba(255,255,255,0.65), 0 1px 3px rgba(74,14,78,0.12)',
          animationDelay: '0.08s',
        }}>{t.chaos_seismogram_title || 'A year in chaos.'}</div>

        <div className="a-fade-up" style={{
          marginTop: 28, padding: '24px 18px 16px',
          background: '#fff', borderRadius: 24,
          border: '2px solid rgba(255,255,255,0.85)',
          boxShadow: `0 8px 0 ${VIOLET}33, 0 22px 36px -10px ${VIOLET}88`,
          animationDelay: '0.2s',
        }}>
          <div style={{
            display: 'flex', alignItems: 'flex-end',
            height: 180, gap: 2,
          }}>
            {bars.map((it, i) => {
              const h = Math.max(3, Math.round(it * 178));
              const hue = it > 0.6 ? MAGENTA : it > 0.3 ? CORAL : it > 0.05 ? GOLD : 'rgba(74,14,78,0.20)';
              return (
                <div key={i} style={{
                  flex: 1, minWidth: 2,
                  height: h, background: hue,
                  borderRadius: 3,
                  animation: 'fadeUp 0.9s cubic-bezier(0.16,1,0.3,1) both',
                  animationDelay: `${0.3 + Math.min(i, 30) * 0.01}s`,
                }} />
              );
            })}
          </div>
          <div className="fs-mono" style={{
            display: 'flex', justifyContent: 'space-between',
            marginTop: 12, fontSize: 11, color: MUTED, fontWeight: 700,
            letterSpacing: '0.08em',
          }}>
            <span>{monthLabel(firstDay)}</span>
            <span>{data.length} {t.chaos_unit_days || 'days'}</span>
            <span>{monthLabel(lastDay)}</span>
          </div>
        </div>

        <div className="fs-sans a-fade-up" style={{
          marginTop: 24, fontSize: 14, lineHeight: 1.45,
          color: 'rgba(74,14,78,0.60)', fontWeight: 600, textAlign: 'center',
          animationDelay: '0.4s',
        }}>
          {t.chaos_seismogram_help || 'Every bar is a day. Pink = riot, gold = busy, white = silence.'}
        </div>
      </div>
    </SlideShell>
  );
}

// Visualization row beneath the big number — gives the slide texture.
// Each award gets a different visual that matches its theme.
function AwardVisual({ awardKey, award, theme, t }) {
  if (awardKey === 'loudest') {
    // Wall of emojis — uses the count so it scales with intensity.
    const emojis = ['🔥', '😂', '💀', '🎉', '⚡', '🚨', '💥', '👀'];
    const n = Math.min(award.emojiCount || 0, 16);
    return (
      <div className="a-fade-up" style={{
        marginTop: 18, display: 'flex', flexWrap: 'wrap', gap: 6,
        animationDelay: '0.4s', maxWidth: 320,
      }}>
        {Array.from({ length: n }).map((_, i) => (
          <span key={i} style={{ fontSize: 24, lineHeight: 1, opacity: 0.9 + (i % 3) * 0.03 }}>
            {emojis[i % emojis.length]}
          </span>
        ))}
      </div>
    );
  }
  if (awardKey === 'speedRun') {
    // Stack of mini chat bubbles representing the message flurry.
    const n = Math.min(award.count || 0, 14);
    return (
      <div className="a-fade-up" style={{
        marginTop: 18, display: 'flex', flexDirection: 'column', gap: 4,
        animationDelay: '0.4s', alignItems: 'flex-start',
      }}>
        {Array.from({ length: Math.min(5, Math.ceil(n / 3)) }).map((_, row) => (
          <div key={row} style={{ display: 'flex', gap: 4 }}>
            {Array.from({ length: 3 }).map((_, c) => (
              <div key={c} style={{
                width: 18 + (c % 2) * 8, height: 10,
                background: theme.fg, opacity: 0.5 + (c % 2) * 0.3,
                borderRadius: 6,
              }} />
            ))}
          </div>
        ))}
      </div>
    );
  }
  if (awardKey === 'groupRiot') {
    // Avatar circles representing the participants.
    const n = Math.min(award.uniqueSenders || 0, 8);
    const colors = ['#FFD700', '#FF1867', '#00BFFF', '#43AA8B', '#f06449', '#FF8C00', '#FF69B4', '#573280'];
    return (
      <div className="a-fade-up" style={{
        marginTop: 18, display: 'flex', gap: -8, animationDelay: '0.4s', flexWrap: 'wrap',
      }}>
        {Array.from({ length: n }).map((_, i) => (
          <div key={i} style={{
            width: 36, height: 36, borderRadius: '50%',
            background: colors[i % colors.length],
            border: '3px solid rgba(255,255,255,0.95)',
            marginInlineStart: i === 0 ? 0 : -10,
            boxShadow: '0 4px 10px rgba(0,0,0,0.25)',
          }} />
        ))}
      </div>
    );
  }
  if (awardKey === 'latest') {
    // Stars + moon arrangement.
    return (
      <div className="a-fade-up" style={{ marginTop: 18, display: 'flex', gap: 8, animationDelay: '0.4s' }}>
        {['✦', '✧', '✦', '★', '✧'].map((s, i) => (
          <span key={i} style={{ fontSize: 22 + (i % 2) * 6, color: theme.accent, opacity: 0.8 - i * 0.08 }}>{s}</span>
        ))}
      </div>
    );
  }
  if (awardKey === 'capsRiot') {
    return (
      <div className="fs-display a-fade-up" style={{
        marginTop: 16, fontSize: 22, fontWeight: 800, color: theme.fg,
        letterSpacing: '0.04em', lineHeight: 1.1, opacity: 0.85,
        animationDelay: '0.4s',
      }}>{t.chaos_award_capsRiot_shout || 'STOP SHOUTING!!'}</div>
    );
  }
  if (awardKey === 'deadZone') {
    return (
      <div className="fs-mono a-fade-up" style={{
        marginTop: 16, fontSize: 36, color: theme.fg, opacity: 0.5,
        letterSpacing: '0.4em', animationDelay: '0.4s',
      }}>· · · · ·</div>
    );
  }
  return null;
}

function SlideAward({ t, lang, awardKey, award }) {
  const theme = AWARD_THEMES[awardKey];
  const label = t[`chaos_award_${awardKey}_label`] || awardKey.toUpperCase();
  let big = '';
  let small = '';
  if (awardKey === 'loudest') {
    big = `${award.emojiCount}`;
    small = t.chaos_award_loudest_unit || 'emojis in 60 seconds';
  } else if (awardKey === 'speedRun') {
    big = `${award.count}`;
    small = t.chaos_award_speedRun_unit || 'messages in 60 seconds';
  } else if (awardKey === 'groupRiot') {
    big = `${award.uniqueSenders}`;
    small = t.chaos_award_groupRiot_unit || 'people active in the same minute';
  } else if (awardKey === 'capsRiot') {
    big = `${award.capsCount}`;
    small = t.chaos_award_capsRiot_unit || 'ALL-CAPS messages in 60s';
  } else if (awardKey === 'latest') {
    const h = new Date(award.ts).getHours().toString().padStart(2, '0');
    const m = new Date(award.ts).getMinutes().toString().padStart(2, '0');
    big = `${h}:${m}`;
    small = (t.chaos_award_latest_unit || 'on {date}').replace('{date}', dayOnly(award.ts, lang));
  } else if (awardKey === 'deadZone') {
    big = `${award.days || Math.ceil(award.hours / 24)}`;
    small = t.chaos_award_deadZone_unit || 'days of pure silence';
  }
  const dark = theme.bg !== GOLD;
  // Responsive font: shorter strings get bigger.
  const bigLen = String(big).length;
  const bigSize = bigLen <= 2 ? 'clamp(110px, 36vw, 180px)'
                : bigLen <= 3 ? 'clamp(90px, 28vw, 150px)'
                : bigLen <= 4 ? 'clamp(72px, 22vw, 120px)'
                :              'clamp(56px, 18vw, 96px)';
  return (
    <SlideShell bg={theme.bg} dark={dark}>
      <FloatingBlobs tint={theme.accent} dark={dark} />
      {/* huge background emoji — bigger + brighter so it reads. */}
      <div aria-hidden style={{
        position: 'absolute', insetInlineEnd: -50, top: -50,
        fontSize: 360, lineHeight: 1, opacity: 0.18,
        pointerEvents: 'none', color: theme.fg,
        transform: 'rotate(-10deg)',
      }}>{theme.emoji}</div>

      <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div className="fs-mono a-fade-up" style={{
          fontSize: 12, letterSpacing: '0.26em', textTransform: 'uppercase',
          color: theme.fg, opacity: 0.85, fontWeight: 800,
        }}>🏆 {t.chaos_awards_eyebrow || 'CHAOS AWARD'}</div>
        <div className="fs-display a-fade-up" dir="auto" style={{
          marginTop: 12, fontSize: 'clamp(26px, 8vw, 40px)', fontWeight: 800, color: theme.fg,
          letterSpacing: '-0.035em', lineHeight: 1.02,
          textShadow: dark ? '0 2px 4px rgba(0,0,0,0.25)' : '0 1px 0 rgba(255,255,255,0.55)',
          animationDelay: '0.08s',
        }}>
          {theme.emoji} {label}
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start' }}>
          <div className="fs-display a-fade-up" style={{
            fontSize: bigSize, fontWeight: 800, color: theme.accent,
            letterSpacing: '-0.05em', lineHeight: 0.85,
            textShadow: dark
              ? '0 6px 0 rgba(0,0,0,0.30), 0 10px 28px rgba(0,0,0,0.45)'
              : '0 4px 0 rgba(74,14,78,0.20), 0 10px 24px rgba(74,14,78,0.30)',
            animationDelay: '0.18s',
            // Don't let the number push out horizontally.
            maxWidth: '100%',
          }}>{big}</div>
          <div className="fs-sans a-fade-up" style={{
            marginTop: 12, fontSize: 18, fontWeight: 700,
            color: theme.fg, opacity: 0.92, lineHeight: 1.3, maxWidth: '95%',
            animationDelay: '0.30s',
          }}>{small}</div>

          {/* The visualization row — turns each award into something
              you can SEE, not just read. */}
          <AwardVisual awardKey={awardKey} award={award} theme={theme} t={t} />
        </div>

        {award.ts && (
          <div className="fs-mono a-fade-up" style={{
            fontSize: 11, fontWeight: 700, opacity: 0.78,
            color: theme.fg, letterSpacing: '0.10em',
            animationDelay: '0.55s',
          }}>📅 {formatPeakTime(award.ts, lang)}</div>
        )}
      </div>
    </SlideShell>
  );
}

function SlidePeakIntro({ t }) {
  return (
    <SlideShell>
      <FloatingBlobs tint={MAGENTA} />
      <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div className="fs-mono a-fade-up" style={{
          fontSize: 13, letterSpacing: '0.24em', textTransform: 'uppercase',
          color: MAGENTA, fontWeight: 800,
        }}>📈 {t.chaos_peaks_intro_eyebrow || 'NOW THE PEAKS'}</div>
        <div className="fs-display a-fade-up" style={{
          marginTop: 14, fontSize: 56, fontWeight: 800, color: EGGPLANT,
          letterSpacing: '-0.045em', lineHeight: 0.95,
          textShadow: '0 2px 0 rgba(255,255,255,0.65)',
          animationDelay: '0.08s',
        }}>
          {t.chaos_peaks_intro_title || 'The 3 wildest minutes.'}
        </div>
        <div className="fs-sans a-fade-up" style={{
          marginTop: 14, fontSize: 17, lineHeight: 1.45,
          color: 'rgba(74,14,78,0.65)', fontWeight: 600,
          animationDelay: '0.2s',
        }}>
          {t.chaos_peaks_intro_sub || 'With the actual messages people sent. Brace yourself.'}
        </div>
      </div>
    </SlideShell>
  );
}

function SlidePeak({ t, lang, peak, rank }) {
  const titleInfo = PEAK_TITLES[peak.title] || PEAK_TITLES.late;
  const eyebrow = t[`chaos_peak_${peak.title}_eyebrow`] || titleInfo.eyebrow;
  const headline = t[`chaos_peak_${peak.title}_title`] || titleInfo.fallback;
  const isWinner = rank === 0;
  return (
    <SlideShell bg={isWinner ? `linear-gradient(180deg, #1a0033 0%, #2a0645 60%, #0A192F 100%)` : undefined} dark={isWinner}>
      {!isWinner && <FloatingBlobs tint={CORAL} />}
      {isWinner && <FloatingBlobs tint={MAGENTA} dark />}

      <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div className="fs-mono a-fade-up" style={{
          fontSize: 12, letterSpacing: '0.24em', textTransform: 'uppercase',
          color: isWinner ? GOLD : CORAL, fontWeight: 800,
        }}>{isWinner ? '🏆 ' : ''}#{rank + 1} {eyebrow}</div>
        <div className="fs-display a-fade-up" dir="auto" style={{
          marginTop: 12, fontSize: isWinner ? 42 : 36, fontWeight: 800,
          color: isWinner ? '#fff' : EGGPLANT,
          letterSpacing: '-0.04em', lineHeight: 1.0,
          textShadow: isWinner ? '0 3px 0 rgba(0,0,0,0.4)' : '0 2px 0 rgba(255,255,255,0.55)',
          animationDelay: '0.08s',
        }}>{headline}</div>
        <div className="fs-mono a-fade-up" style={{
          marginTop: 10, fontSize: 12, fontWeight: 700,
          color: isWinner ? 'rgba(255,255,255,0.78)' : MUTED,
          letterSpacing: '0.08em',
          animationDelay: '0.16s',
        }}>
          {peak.count} {t.chaos_unit_msgs || 'msgs'} · {peak.uniqueSenders} {t.chaos_unit_ppl || 'ppl'} · {formatPeakTime(peak.ts, lang)}
        </div>

        <div className="a-fade-up" style={{
          marginTop: 22, flex: 1, minHeight: 0, overflow: 'hidden',
          display: 'flex', flexDirection: 'column', gap: 7,
          animationDelay: '0.28s',
        }}>
          {(peak.excerpts || []).slice(0, 7).map((m, i) => (
            <div key={i} dir="auto" style={{
              background: isWinner ? 'rgba(255,255,255,0.08)' : '#fff',
              border: isWinner ? '1px solid rgba(255,255,255,0.18)' : '1.5px solid rgba(255,255,255,0.95)',
              borderRadius: 16, padding: '10px 12px',
              flexShrink: 0,
              boxShadow: isWinner ? 'none' : '0 4px 0 rgba(74,14,78,0.10), 0 10px 18px -6px rgba(74,14,78,0.18)',
            }}>
              <div className="fs-mono" style={{
                fontSize: 10, fontWeight: 800,
                color: isWinner ? GOLD : CORAL,
                letterSpacing: '0.10em',
              }}>{m.author}</div>
              <div className="fs-sans" style={{
                marginTop: 2, fontSize: 14, fontWeight: 500, lineHeight: 1.35,
                color: isWinner ? '#fff' : EGGPLANT,
              }}>
                {m.isVoice ? '🎙️ voice note' : m.hasMedia ? '🖼 media' : m.content}
              </div>
            </div>
          ))}
        </div>
      </div>
    </SlideShell>
  );
}

function SlideOutro({ t, chaos }) {
  const total = chaos.peaks?.length || 0;
  return (
    <SlideShell>
      <FloatingBlobs tint={GOLD} />
      <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
        <div aria-hidden style={{ fontSize: 72, marginBottom: 8 }}>🎬</div>
        <div className="fs-mono a-fade-up" style={{
          fontSize: 12, letterSpacing: '0.26em', textTransform: 'uppercase',
          color: CORAL, fontWeight: 800,
        }}>{t.chaos_outro_eyebrow || 'THAT WAS CHAOS'}</div>
        <div className="fs-display a-fade-up" style={{
          marginTop: 12, fontSize: 48, fontWeight: 800, color: EGGPLANT,
          letterSpacing: '-0.04em', lineHeight: 1.0,
          textShadow: '0 2px 0 rgba(255,255,255,0.65)',
          animationDelay: '0.08s',
        }}>{t.chaos_outro_title || 'Your year in pure mayhem.'}</div>
        <div className="fs-sans a-fade-up" style={{
          marginTop: 18, fontSize: 16, lineHeight: 1.45,
          color: 'rgba(74,14,78,0.65)', fontWeight: 600, maxWidth: 280,
          animationDelay: '0.2s',
        }}>
          {(t.chaos_outro_sub || '{n} peaks. The seismogram. The dead zones. All you.').replace('{n}', total)}
        </div>
      </div>
    </SlideShell>
  );
}

// ── Main controller ────────────────────────────────────────────
export default function ChaosTimeline({ analytics, t, lang, onBack }) {
  const chaos = analytics?.chaos;

  // Compute the slide lineup once per chaos payload. Filters out
  // awards/peaks that don't have data so the deck stays tight.
  const slides = useMemo(() => {
    if (!chaos) return [];
    const list = [
      { id: 'intro' },
    ];
    if ((chaos.seismogram?.length || 0) > 1) list.push({ id: 'seismogram' });
    const order = ['loudest', 'speedRun', 'groupRiot', 'latest', 'capsRiot', 'deadZone'];
    for (const key of order) {
      const a = chaos.awards?.[key];
      if (!a) continue;
      if (key === 'deadZone' && !a.fromTs) continue;
      list.push({ id: `award:${key}`, awardKey: key, award: a });
    }
    const peaks = chaos.peaks || [];
    if (peaks.length > 0) {
      list.push({ id: 'peaks-intro' });
      // Top 3 peaks, climaxing on #1 (presented last).
      const top = peaks.slice(0, 3);
      for (let i = top.length - 1; i >= 0; i--) {
        list.push({ id: `peak:${i}`, peak: top[i], rank: i });
      }
    }
    list.push({ id: 'outro' });
    return list;
  }, [chaos]);

  const [slide, setSlide] = useState(0);
  const dirRef = useRef(1);
  const total = slides.length;

  if (!chaos || total === 0) {
    return <ChaosEmpty t={t} onBack={onBack} needsReupload={!chaos} />;
  }

  const next = () => { dirRef.current = 1;  setSlide(s => Math.min(s + 1, total - 1)); };
  const prev = () => { dirRef.current = -1; setSlide(s => Math.max(s - 1, 0)); };
  const onSlideClick = (e) => {
    if (e.target.closest('button, a, input, textarea, label, [role="button"]')) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < rect.width * 0.3) prev();
    else if (slide < total - 1) next();
    else onBack();
  };

  const current = slides[slide];
  let body;
  if (current.id === 'intro')          body = <SlideIntro t={t} lang={lang} chaos={chaos} />;
  else if (current.id === 'seismogram') body = <SlideSeismogram t={t} lang={lang} chaos={chaos} />;
  else if (current.id === 'peaks-intro') body = <SlidePeakIntro t={t} />;
  else if (current.id === 'outro')      body = <SlideOutro t={t} chaos={chaos} />;
  else if (current.id.startsWith('award:'))
    body = <SlideAward t={t} lang={lang} awardKey={current.awardKey} award={current.award} />;
  else if (current.id.startsWith('peak:'))
    body = <SlidePeak t={t} lang={lang} peak={current.peak} rank={current.rank} />;

  return (
    <div style={{ position: 'absolute', inset: 0, background: WHITE }}>
      <div
        key={`${current.id}-${slide}`}
        onClick={onSlideClick}
        className={dirRef.current >= 0 ? 'slide-in-right' : 'slide-in-left'}
        style={{ position: 'absolute', inset: 0, overflow: 'hidden', zIndex: 1 }}>
        {body}
      </div>

      {/* Overlay: progress bar + close button */}
      <div style={{ position: 'absolute', top: 'env(safe-area-inset-top, 0px)', left: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 5 }}>
        {/* progress bar */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', gap: 5, padding: '14px 14px 0' }}>
          {slides.map((_, i) => (
            <div key={i} style={{
              flex: 1, height: 3, borderRadius: 8,
              background: i < slide ? 'rgba(74,14,78,0.50)' : i === slide ? EGGPLANT : 'rgba(74,14,78,0.18)',
              transition: 'background 0.3s',
            }} />
          ))}
        </div>
        {/* close */}
        <button onClick={onBack} className="press" aria-label={t.a11y_close || 'Close'} style={{
          position: 'absolute', top: 34, insetInlineEnd: 16, pointerEvents: 'auto',
          background: 'rgba(74,14,78,0.18)', backdropFilter: 'blur(12px)',
          color: '#fff', border: 'none', width: 40, height: 40,
          borderRadius: '50%', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── Empty-state view (kept) ────────────────────────────────────
function ChaosEmpty({ t, onBack, needsReupload }) {
  const title = needsReupload
    ? (t.chaos_empty_old_title || 'Re-upload to unlock')
    : (t.chaos_empty_title || 'No chaos found');
  const body = needsReupload
    ? (t.chaos_empty_old_body || 'This recap was saved before Chaos Mode existed. Re-upload your chat to see the wildest moments.')
    : (t.chaos_empty_body || 'This chat is suspiciously quiet. Try a livelier group.');
  return (
    <div style={{
      position: 'absolute', inset: 0, overflow: 'hidden',
      background: `linear-gradient(180deg, ${CREAM} 0%, #FFF0E2 46%, ${PINK} 100%)`,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '24px', gap: 12, textAlign: 'center',
    }}>
      <div aria-hidden style={{ fontSize: 64 }}>{needsReupload ? '📂' : '🌊'}</div>
      <div className="fs-display" style={{ fontSize: 24, fontWeight: 800, color: PLUM }}>{title}</div>
      <div className="fs-sans" style={{ fontSize: 14, color: MUTED, maxWidth: 300 }}>{body}</div>
      <button onClick={onBack} className="press" style={{
        marginTop: 12, padding: '12px 22px', borderRadius: 999,
        background: `linear-gradient(135deg, ${GOLD}, ${CORAL})`, color: EGGPLANT,
        border: '2px solid rgba(255,255,255,0.8)', cursor: 'pointer',
        fontWeight: 800, fontSize: 14,
      }}>{t.rm_back || '← Back'}</button>
    </div>
  );
}
