// ============================================================
// ChaosTimeline — the "Chaos Mode" view. Surfaces the wildest
// moments of the chat: top peaks, themed awards, and a year-strip
// seismogram.
//
// Two things make this UNIQUE vs. the regular Wrapped deck:
//   1) The seismogram strip — one heat-bar per day across the
//      whole chat, the only place we render a continuous time
//      axis.
//   2) Real message excerpts — taps on a peak expand it to show
//      what people actually said. Wrapped intentionally never
//      quotes raw messages; here it's the whole point.
// ============================================================
import { useState } from 'react';

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
const MUTED     = 'rgba(74,14,78,0.55)';

const POP_SHADOW = (hex) => `0 7px 0 ${hex}33, 0 18px 32px -10px ${hex}88`;

// Auto-generated peak title slugs → (eyebrow, headline) — keys in i18n;
// these fallbacks let the view read sensibly even before translations land.
const PEAK_TITLES = {
  late_night:  { eyebrow: '🌙 LATE NIGHT',  fallback: 'The 3 AM Eruption' },
  morning:     { eyebrow: '☕ MORNING',     fallback: 'The Coffee Riot' },
  midmorning:  { eyebrow: '⏰ MIDMORNING',  fallback: 'The Morning Surge' },
  lunch:       { eyebrow: '🍔 LUNCH',       fallback: 'The Lunch Hour Madness' },
  afternoon:   { eyebrow: '🌞 AFTERNOON',   fallback: 'The Afternoon Storm' },
  evening:     { eyebrow: '🌆 EVENING',     fallback: 'The Evening Riot' },
  late:        { eyebrow: '🌌 NIGHT',       fallback: 'The Late-Night Storm' },
};

const AWARDS_LAYOUT = [
  { key: 'loudest',   emoji: '🎤', tint: MAGENTA, color: '#fff' },
  { key: 'speedRun',  emoji: '⚡',  tint: GOLD,    color: EGGPLANT },
  { key: 'groupRiot', emoji: '👥', tint: SKY,     color: '#fff' },
  { key: 'latest',    emoji: '🌙', tint: VIOLET,  color: '#fff' },
  { key: 'capsRiot',  emoji: '📣', tint: CORAL,   color: '#fff' },
  { key: 'deadZone',  emoji: '🪦', tint: MINT,    color: '#fff' },
];

function formatPeakTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const dayPart = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const timePart = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${dayPart} · ${timePart}`;
}

// ── Seismogram strip — fixed-width bars, intensity-mapped colour.
function Seismogram({ data }) {
  if (!data || data.length < 2) return null;
  // Aim for ~90 visible bars max so each one is wide enough to read.
  const stride = Math.max(1, Math.ceil(data.length / 90));
  const bars = [];
  for (let i = 0; i < data.length; i += stride) {
    let intensity = 0;
    for (let j = i; j < Math.min(i + stride, data.length); j++) {
      intensity = Math.max(intensity, data[j].intensity);
    }
    bars.push({ index: i, intensity });
  }
  const firstDay = new Date(data[0].day);
  const lastDay = new Date(data[data.length - 1].day);
  const monthLabel = (d) => d.toLocaleDateString(undefined, { month: 'short' });
  return (
    <div style={{
      position: 'relative',
      background: '#fff', borderRadius: 22, padding: '16px 14px 12px',
      border: '2px solid rgba(255,255,255,0.85)',
      boxShadow: POP_SHADOW(VIOLET),
    }}>
      <div className="fs-mono" style={{
        fontSize: 10, letterSpacing: '0.20em', textTransform: 'uppercase',
        color: VIOLET, fontWeight: 800, marginBottom: 8,
      }}>
        🌊 THE SEISMOGRAM
      </div>
      <div style={{
        display: 'flex', alignItems: 'flex-end',
        height: 56, gap: 2, padding: '0 2px',
      }}>
        {bars.map((b, i) => {
          const h = Math.max(2, Math.round(b.intensity * 54));
          const hue = b.intensity > 0.6 ? MAGENTA
                    : b.intensity > 0.3 ? CORAL
                    : b.intensity > 0.05 ? GOLD
                    : 'rgba(74,14,78,0.20)';
          return (
            <div key={i} style={{
              flex: 1, minWidth: 2,
              height: h, background: hue,
              borderRadius: 2,
              opacity: b.intensity > 0 ? 1 : 0.4,
            }} />
          );
        })}
      </div>
      <div className="fs-mono" style={{
        display: 'flex', justifyContent: 'space-between',
        marginTop: 8, fontSize: 10, color: MUTED, fontWeight: 700,
        letterSpacing: '0.06em',
      }}>
        <span>{monthLabel(firstDay)} {firstDay.getFullYear()}</span>
        <span>{data.length} {data.length === 1 ? 'day' : 'days'}</span>
        <span>{monthLabel(lastDay)} {lastDay.getFullYear()}</span>
      </div>
    </div>
  );
}

// ── Peak card — collapsed shows headline + stats, tap reveals real msgs.
function PeakCard({ peak, rank, expanded, onToggle, t }) {
  const titleInfo = PEAK_TITLES[peak.title] || PEAK_TITLES.late;
  const eyebrow = t[`chaos_peak_${peak.title}_eyebrow`] || titleInfo.eyebrow;
  const headline = t[`chaos_peak_${peak.title}_title`] || titleInfo.fallback;
  return (
    <div style={{
      background: '#fff', borderRadius: 20,
      border: '2px solid rgba(255,255,255,0.85)',
      boxShadow: POP_SHADOW(rank === 0 ? MAGENTA : CORAL),
      overflow: 'hidden',
    }}>
      <button onClick={onToggle} className="press" style={{
        appearance: 'none', width: '100%', textAlign: 'start',
        background: 'transparent', border: 'none', cursor: 'pointer',
        padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
        fontFamily: 'inherit', color: EGGPLANT,
      }}>
        <div style={{
          flexShrink: 0, width: 36, height: 36, borderRadius: 12,
          background: rank === 0 ? `linear-gradient(135deg, ${MAGENTA}, ${CORAL})` : `${CORAL}1f`,
          color: rank === 0 ? '#fff' : CORAL,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 800, fontSize: 16,
          boxShadow: rank === 0 ? `0 4px 0 ${MAGENTA}55` : 'none',
        }}>#{rank + 1}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="fs-mono" style={{
            fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase',
            color: CORAL, fontWeight: 800, marginBottom: 2,
          }}>{eyebrow}</div>
          <div className="fs-display" style={{
            fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em',
            lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>{headline}</div>
          <div className="fs-mono" style={{
            fontSize: 11, color: MUTED, fontWeight: 600, marginTop: 4,
            letterSpacing: '0.04em',
          }}>
            {peak.count} msgs · {peak.uniqueSenders} ppl · {formatPeakTime(peak.ts)}
          </div>
        </div>
        <div style={{
          flexShrink: 0, fontSize: 14, color: MUTED,
          transform: expanded ? 'rotate(180deg)' : 'rotate(0)',
          transition: 'transform 0.18s',
        }}>▾</div>
      </button>

      {expanded && peak.excerpts?.length > 0 && (
        <div style={{
          padding: '4px 12px 14px',
          background: 'rgba(74,14,78,0.03)',
          borderTop: '1px solid rgba(74,14,78,0.08)',
        }}>
          <div className="fs-mono" style={{
            fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase',
            color: VIOLET, fontWeight: 800, padding: '10px 4px 8px',
          }}>
            {t.chaos_what_happened || 'WHAT ACTUALLY HAPPENED'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {peak.excerpts.map((m, i) => (
              <div key={i} dir="auto" style={{
                background: '#fff', borderRadius: 14,
                padding: '8px 10px',
                border: '1px solid rgba(74,14,78,0.08)',
                display: 'flex', flexDirection: 'column', gap: 2,
              }}>
                <div className="fs-mono" style={{
                  fontSize: 9.5, fontWeight: 800, color: CORAL,
                  letterSpacing: '0.08em',
                }}>{m.author}</div>
                <div className="fs-sans" style={{
                  fontSize: 13, fontWeight: 500, color: EGGPLANT, lineHeight: 1.35,
                }}>
                  {m.isVoice ? '🎙️ voice note'
                    : m.hasMedia ? '🖼 media'
                    : m.content}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Award card — coloured tile with single bold stat.
function AwardCard({ award, layout, t }) {
  if (!award) return null;
  const labelKey = `chaos_award_${layout.key}_label`;
  const label = t[labelKey] || layout.key.toUpperCase();

  let valueLine;
  if (layout.key === 'deadZone') {
    valueLine = award.days > 0
      ? `${award.days} ${award.days === 1 ? 'day' : 'days'} of silence`
      : `${award.hours}h of silence`;
  } else if (layout.key === 'loudest') {
    valueLine = `${award.emojiCount} emojis in 60s`;
  } else if (layout.key === 'speedRun') {
    valueLine = `${award.count} msgs in 60s`;
  } else if (layout.key === 'groupRiot') {
    valueLine = `${award.uniqueSenders} ppl active in 60s`;
  } else if (layout.key === 'latest') {
    valueLine = formatPeakTime(award.ts);
  } else if (layout.key === 'capsRiot') {
    valueLine = `${award.capsCount} ALL-CAPS msgs in 60s`;
  } else {
    valueLine = `${award.count} msgs`;
  }

  return (
    <div style={{
      background: layout.tint, color: layout.color,
      borderRadius: 18, padding: '14px 14px',
      border: '2px solid rgba(255,255,255,0.78)',
      boxShadow: POP_SHADOW(layout.tint),
      minHeight: 120,
      display: 'flex', flexDirection: 'column', gap: 4,
      position: 'relative', overflow: 'hidden',
    }}>
      <div aria-hidden style={{
        position: 'absolute', insetInlineEnd: -8, top: -10,
        fontSize: 70, lineHeight: 1, opacity: 0.18,
        pointerEvents: 'none',
      }}>{layout.emoji}</div>
      <div className="fs-mono" style={{
        fontSize: 10, letterSpacing: '0.20em', textTransform: 'uppercase',
        fontWeight: 800, opacity: 0.92,
      }}>{layout.emoji} {label}</div>
      <div className="fs-display" style={{
        fontSize: 18, fontWeight: 800, letterSpacing: '-0.025em',
        lineHeight: 1.15, marginTop: 2,
      }}>{valueLine}</div>
      <div style={{ flex: 1 }} />
      {award.ts && layout.key !== 'latest' && layout.key !== 'deadZone' && (
        <div className="fs-mono" style={{
          fontSize: 10, fontWeight: 700, opacity: 0.78, letterSpacing: '0.04em',
        }}>{formatPeakTime(award.ts)}</div>
      )}
      {layout.key === 'deadZone' && award.fromTs && (
        <div className="fs-mono" style={{
          fontSize: 10, fontWeight: 700, opacity: 0.78, letterSpacing: '0.04em',
        }}>{formatPeakTime(award.fromTs)} →</div>
      )}
    </div>
  );
}

// ── Main view ──────────────────────────────────────────────────
export default function ChaosTimeline({ analytics, t, onBack }) {
  const chaos = analytics?.chaos;
  const [expandedPeak, setExpandedPeak] = useState(0);

  if (!chaos || (chaos.peaks?.length || 0) === 0) {
    // Distinguish two distinct empty states:
    //   - chaos missing entirely → the saved recap predates this feature,
    //     so the raw message buckets are gone. User must re-upload.
    //   - chaos present but no peaks → the chat is genuinely too quiet
    //     for any minute to clear the 2-msg threshold.
    const needsReupload = !chaos;
    const title = needsReupload
      ? (t.chaos_empty_old_title || 'Re-upload to unlock')
      : (t.chaos_empty_title || 'No chaos found');
    const body = needsReupload
      ? (t.chaos_empty_old_body || 'This recap was saved before Chaos Mode existed. Re-upload your chat to see the wildest moments.')
      : (t.chaos_empty_body || 'This chat is suspiciously quiet. Try a livelier group.');
    return (
      <div style={{
        position: 'relative', height: '100%', overflow: 'hidden',
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

  const peaks = chaos.peaks || [];
  const awards = chaos.awards || {};
  const seismogram = chaos.seismogram || [];

  return (
    <div className="no-sb" style={{
      height: '100%', overflowY: 'auto', position: 'relative',
      background: `linear-gradient(180deg, ${CREAM} 0%, #FFF0E2 46%, ${PINK} 100%)`,
    }}>
      {/* fixed bg blobs — match the slide-deck mood */}
      <div aria-hidden style={{ position: 'fixed', top: -60, insetInlineStart: -70, width: 240, height: 240, borderRadius: '50%', background: GOLD, opacity: 0.40, filter: 'blur(70px)', pointerEvents: 'none', zIndex: 0 }} />
      <div aria-hidden style={{ position: 'fixed', top: 100, insetInlineEnd: -70, width: 220, height: 220, borderRadius: '50%', background: MAGENTA, opacity: 0.22, filter: 'blur(72px)', pointerEvents: 'none', zIndex: 0 }} />
      <div aria-hidden style={{ position: 'fixed', bottom: -50, insetInlineEnd: -50, width: 240, height: 240, borderRadius: '50%', background: SKY, opacity: 0.28, filter: 'blur(70px)', pointerEvents: 'none', zIndex: 0 }} />
      <div aria-hidden style={{ position: 'fixed', bottom: 80, insetInlineStart: -60, width: 200, height: 200, borderRadius: '50%', background: CORAL, opacity: 0.22, filter: 'blur(62px)', pointerEvents: 'none', zIndex: 0 }} />

      <div style={{
        position: 'relative', zIndex: 1, minHeight: '100%',
        padding: 'calc(env(safe-area-inset-top, 0px) + 22px) 18px calc(env(safe-area-inset-bottom, 0px) + 96px)',
      }}>
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <button onClick={onBack} className="press" aria-label={t.rm_back || 'Back'} style={{
            width: 40, height: 40, borderRadius: 999, background: '#fff',
            border: `2px solid ${CORAL}33`, color: EGGPLANT, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: POP_SHADOW(CORAL), flexShrink: 0,
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div>
            <div className="fs-mono" style={{
              fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase',
              color: CORAL, fontWeight: 800,
            }}>⚡ {t.menu_chaos_eyebrow || 'CHAOS MODE'}</div>
            <div className="fs-display" style={{
              fontSize: 26, fontWeight: 800, color: EGGPLANT, letterSpacing: '-0.03em',
              marginTop: 2,
            }}>{t.chaos_title || 'The wildest moments'}</div>
          </div>
        </div>

        {/* Seismogram — unique to Chaos Mode */}
        <Seismogram data={seismogram} />

        {/* Awards */}
        <div className="fs-mono" style={{
          fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase',
          color: VIOLET, fontWeight: 800, marginTop: 22, marginBottom: 10, paddingInlineStart: 4,
        }}>🏆 {t.chaos_awards_section || 'CHAOS AWARDS'}</div>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10,
        }}>
          {AWARDS_LAYOUT.map(layout => (
            <AwardCard key={layout.key} award={awards[layout.key]} layout={layout} t={t} />
          ))}
        </div>

        {/* Peaks */}
        <div className="fs-mono" style={{
          fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase',
          color: MAGENTA, fontWeight: 800, marginTop: 22, marginBottom: 10, paddingInlineStart: 4,
        }}>📈 {t.chaos_peaks_section || 'THE 10 PEAKS'}</div>
        <div className="fs-sans" style={{
          fontSize: 12.5, color: MUTED, marginBottom: 12, paddingInlineStart: 4,
        }}>{t.chaos_peaks_help || 'Tap a peak to see what actually happened.'}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {peaks.map((peak, i) => (
            <PeakCard
              key={i}
              peak={peak}
              rank={i}
              expanded={expandedPeak === i}
              onToggle={() => setExpandedPeak(expandedPeak === i ? -1 : i)}
              t={t}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
