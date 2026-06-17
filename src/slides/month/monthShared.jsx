// Shared building blocks for the "4 weeks" (month) recap slides.
// Keeps the month deck visually consistent with the rest of the app: same
// SlideShell, same card shadows, same type ramp — just bite-sized stats with
// a month-over-month delta chip where it adds drama.
import React from 'react';
import { isRtlText } from '../../i18n';

// Ultra-Pop palette echoes the existing slides. DEEP is the warm shadow used
// under every floating card (matches SlideMetricLeaderboard's #C25516 family).
export const INK = '#2a0645';
export const INK_SOFT = 'rgba(42,6,69,0.55)';
export const DEEP = '#C25516';
export const POS = '#1a8754';
export const NEG = '#e5484d';

export const CARD_SHADOW = `0 6px 0 ${DEEP}22, 0 14px 24px -8px ${DEEP}55`;

// A floating white card, the month deck's workhorse surface.
export function cardStyle(winner = false, extra = {}) {
  return {
    position: 'relative',
    background: winner ? '#FFF8E0' : '#fff',
    borderRadius: 18,
    border: `2px solid ${winner ? '#FFD700' : 'rgba(255,255,255,0.85)'}`,
    boxShadow: CARD_SHADOW,
    overflow: 'hidden',
    ...extra,
  };
}

// "+14%" trend pill. Up/down triangle is a data indicator (not a button arrow),
// so it stays within the design system. Neutral when there's no prior month.
export function DeltaChip({ pct, label, accent = POS, style = {} }) {
  if (pct == null) return null;
  const up = pct >= 0;
  const color = up ? POS : NEG;
  const sign = up ? '+' : '−';
  return (
    <div className="fs-mono" style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '5px 11px', borderRadius: 999,
      background: `${color}1a`, color,
      fontSize: 12, fontWeight: 800, letterSpacing: '0.02em',
      whiteSpace: 'nowrap', ...style,
    }}>
      <span aria-hidden style={{ fontSize: 9, lineHeight: 1 }}>{up ? '▲' : '▼'}</span>
      <span>{sign}{Math.abs(pct)}%</span>
      {label && <span style={{ opacity: 0.7, fontWeight: 600 }}>{label}</span>}
    </div>
  );
}

// Section eyebrow used at the top of most month slides.
export function Eyebrow({ icon, children, color }) {
  return (
    <div className="fs-sans a-fade-up" dir="auto" style={{
      textAlign: 'center', fontSize: 13, color,
      letterSpacing: '0.18em', fontWeight: 800, textTransform: 'uppercase',
    }}>
      {icon ? `${icon} ` : ''}{children}
    </div>
  );
}

// Big display headline.
export function Title({ children, size = 34, delay = '0.15s', style = {} }) {
  return (
    <div className="fs-display a-fade-up" dir="auto" style={{
      textAlign: 'center', animationDelay: delay,
      fontSize: size, lineHeight: 1.08, letterSpacing: '-0.03em',
      fontWeight: 800, color: '#4A0E4E', padding: '0 8px',
      textShadow: '0 2px 0 rgba(255,255,255,0.65), 0 1px 3px rgba(74,14,78,0.12)',
      overflowWrap: 'break-word', wordBreak: 'break-word',
      ...style,
    }}>
      {children}
    </div>
  );
}

// Name + value row used by the month leaderboards. Mirrors
// SlideMetricLeaderboard exactly so list slides match the pasted template,
// orienting per the *name's* own direction (RTL name → mirrored row).
export function LeaderRow({ author, displayValue, sub, value, max, rank, color, accentBar }) {
  const isWinner = rank === 0;
  const nameLtr = !isRtlText(author);
  const medals = ['🥇', '🥈', '🥉'];
  const medal = rank < 3 ? medals[rank] : '⭐';
  const widthPct = Math.max(8, Math.round((value / (max || 1)) * 100));

  const valueEl = (
    <div className="fs-display" style={{ flexShrink: 0, fontSize: 26, fontWeight: 800, color }}>
      {displayValue}
    </div>
  );
  const medalEl = (
    <div style={{ flexShrink: 0, fontSize: rank < 3 ? 24 : 20, minWidth: 30, textAlign: 'center' }}>
      {medal}
    </div>
  );
  const endGroup = (
    <div style={{
      flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8,
      direction: 'ltr', flexDirection: nameLtr ? 'row' : 'row-reverse',
    }}>
      {valueEl}{medalEl}
    </div>
  );
  const name = (
    <div dir={nameLtr ? 'ltr' : 'rtl'} style={{
      flex: 1, minWidth: 0, paddingInline: 10,
      textAlign: nameLtr ? 'left' : 'right',
    }}>
      <div className="fs-sans" style={{
        fontSize: 15, fontWeight: 700, color: '#4A0E4E',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {author}
      </div>
      {sub && (
        <div className="fs-mono" style={{
          fontSize: 11, color: INK_SOFT, marginTop: 2,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {sub}
        </div>
      )}
    </div>
  );

  return (
    <div className="a-slide-up-far" style={{
      ...cardStyle(isWinner),
      padding: '12px 16px', flexShrink: 0,
      animationDelay: `${0.4 + rank * 0.08}s`,
    }}>
      <div className="a-slide-right" style={{
        position: 'absolute', top: 0, bottom: 0,
        [nameLtr ? 'right' : 'left']: 0,
        background: isWinner ? 'rgba(255,215,0,0.28)' : (accentBar || 'rgba(243,114,44,0.16)'),
        width: `${widthPct}%`,
        animationDelay: `${0.6 + rank * 0.08}s`,
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'relative', display: 'flex', alignItems: 'center',
        direction: 'ltr', flexDirection: nameLtr ? 'row' : 'row-reverse',
      }}>
        {name}{endGroup}
      </div>
    </div>
  );
}

// Localised weekday/short-weekday helpers shared by the bar slides.
export const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
export function dayName(t, idx, short = false) {
  const k = DAY_KEYS[idx];
  return short ? (t[`day_${k}_short`] || k.slice(0, 3)) : (t[`day_${k}`] || k);
}

// Format an hour-of-day (0–23, may be decimal) to "HH:MM".
export function fmtHour(dec) {
  if (dec == null || isNaN(dec)) return '—';
  const h = Math.floor(dec) % 24;
  const m = Math.round((dec - Math.floor(dec)) * 60);
  const mm = m === 60 ? 0 : m;
  const hh = m === 60 ? (h + 1) % 24 : h;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

// Localised date like "Mar 14". Falls back gracefully.
export function fmtDate(value, t) {
  try {
    const d = value instanceof Date ? value : new Date(value);
    const mk = ['mon_jan','mon_feb','mon_mar','mon_apr','mon_may','mon_jun','mon_jul','mon_aug','mon_sep','mon_oct','mon_nov','mon_dec'][d.getMonth()];
    const mon = t && t[mk] ? t[mk] : d.toLocaleDateString(undefined, { month: 'short' });
    return `${mon} ${d.getDate()}`;
  } catch { return ''; }
}
