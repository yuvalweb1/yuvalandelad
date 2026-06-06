import React, { useState } from 'react';
import SlideShell from './SlideShell.jsx';
import ListSlideDecor from '../components/ListSlideDecor.jsx';
import { typedCopy, interp } from '../i18n';

// Metric definitions (same as SlideMetric, but rendered in leaderboard style)
const METRIC_DEFS = {
  double_texts: {
    color: '#f94144',
    icon: '💬',
    decorEmojis: ['💬', '🔥', '💕', '✨', '👀'],
    rows: (a) => (a.users || [])
      .filter(u => u.maxBurst >= 2)
      .sort((x, y) => y.maxBurst - x.maxBurst)
      .map(u => ({ author: u.author, value: u.maxBurst, displayValue: `${u.maxBurst}`, sub: 'in a row', badge: '×' })),
  },
  response_times: {
    color: '#277da1',
    icon: '⚡',
    decorEmojis: ['⚡', '🚀', '⏱️', '💨', '🎯'],
    rows: (a) => {
      const eligible = (a.users || []).filter(u => u.respSampleSize >= 5 && u.avgRespMin != null);
      if (eligible.length === 0) return [];
      const sorted = [...eligible].sort((x, y) => x.avgRespMin - y.avgRespMin);
      const slowest = sorted[sorted.length - 1].avgRespMin;
      return sorted.map(u => ({
        author: u.author,
        value: slowest - u.avgRespMin + 0.5,
        displayValue: u.avgRespMin < 1 ? `${Math.round(u.avgRespMin * 60)}s` : `${u.avgRespMin.toFixed(1)}m`,
        sub: 'avg reply',
        badge: '⚡',
      }));
    },
  },
  night_messages: {
    color: '#8338ec',
    icon: '🌙',
    decorEmojis: ['🌙', '⭐', '😴', '🛏️', '✨'],
    rows: (a) => (a.users || [])
      .filter(u => u.nightPct > 0 && u.nightMessages >= 1)
      .sort((x, y) => y.nightPct - x.nightPct)
      .map(u => ({ author: u.author, value: u.nightPct, displayValue: `${u.nightPct.toFixed(0)}%`, sub: 'after midnight', badge: '🌙' })),
  },
  signature_emoji: {
    color: '#f3722c',
    icon: '😊',
    decorEmojis: ['😊', '🎉', '💎', '✨', '🌟'],
    rows: (a) => (a.users || []).filter(u => u.topEmoji)
      .sort((x, y) => (y.topEmojiCount || 0) - (x.topEmojiCount || 0))
      .map(u => ({ author: u.author, value: u.topEmojiCount || 1, displayValue: u.topEmoji, sub: `${(u.topEmojiCount || 1).toLocaleString()} times`, badge: '😊' })),
  },
};

export function metricHasData(metricKey, a) {
  const def = METRIC_DEFS[metricKey];
  if (!def) return false;
  return def.rows(a).length >= 1;
}

const MAX_ROWS = 5;

const SlideMetricLeaderboard = React.memo(function SlideMetricLeaderboard({ a, t, profile, metricKey }) {
  const def = METRIC_DEFS[metricKey];
  if (!def) return null;
  const allRows = def.rows(a);
  if (allRows.length === 0) return null;
  const overflow = allRows.length - MAX_ROWS;
  const showOverflow = overflow > 0;
  const [expanded, setExpanded] = useState(false);
  const rows = (showOverflow && !expanded) ? allRows.slice(0, MAX_ROWS) : allRows;
  const moreLabel = (t.lb_more || '+{n} more').replace('{n}', overflow);

  const type = profile?.relationship || 'other';
  const eyebrow = typedCopy(t, `m_${metricKey}_eyebrow`, type);
  const title = typedCopy(t, `m_${metricKey}_title`, type);
  const sub = typedCopy(t, `m_${metricKey}_sub`, type);

  const medals = ['🥇', '🥈', '🥉'];
  const DEEP = '#C25516';

  const renderRow = (row, i, opts = {}) => {
    const { isLast = false } = opts;
    const isWinner = i === 0;

    return (
      <div key={row.author} dir="auto" className="a-slide-up-far" style={{
        position: 'relative', padding: '14px 16px',
        background: isWinner ? '#FFF8E0' : '#fff',
        borderRadius: 18,
        border: `2px solid ${isWinner ? '#FFD700' : 'rgba(255,255,255,0.85)'}`,
        boxShadow: `0 6px 0 ${DEEP}22, 0 14px 24px -8px ${DEEP}55`,
        overflow: 'hidden', flexShrink: 0,
        animationDelay: `${0.4 + i * 0.08}s`,
      }}>
        {/* bar fill (over the white card) */}
        <div className="a-slide-right" style={{
          position: 'absolute', top: 0, bottom: 0, insetInlineStart: 0,
          background: `linear-gradient(90deg, ${isWinner ? 'rgba(255,215,0,0.28)' : `rgba(${hexToRgb(def.color)},0.16)`} 0%, rgba(${hexToRgb(def.color)},0.02) 100%)`,
          width: `${Math.max(8, Math.round((row.value / (allRows[0]?.value || 1)) * 100))}%`,
          animationDelay: `${0.6 + i * 0.08}s`,
          pointerEvents: 'none',
        }} />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
          {/* Number on left */}
          <div className="fs-display" style={{
            flexShrink: 0,
            fontSize: 28,
            fontWeight: 800,
            color: def.color,
            minWidth: 40,
            textAlign: 'center',
          }}>
            {row.displayValue}
          </div>

          {/* Name in middle */}
          <div className="fs-sans" style={{
            flex: 1, minWidth: 0, fontSize: 15, fontWeight: 700, color: '#4A0E4E',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            paddingRight: 8,
          }}>
            {row.author}
          </div>

          {/* Medal/icon on right */}
          <div style={{
            flexShrink: 0,
            fontSize: i < 3 ? 24 : 20,
            textAlign: 'center',
            minWidth: 32,
          }}>
            {i < 3 ? medals[i] : '⭐'}
          </div>
        </div>
        {row.sub && (
          <div className="fs-mono" style={{
            marginTop: 4, fontSize: 11, color: 'rgba(74,14,78,0.55)',
            marginInlineStart: 52,
          }}>
            {row.sub}
          </div>
        )}
      </div>
    );
  };

  return (
    <SlideShell bg={def.color} accent={def.color}>
      <ListSlideDecor emojis={def.decorEmojis} />
      <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column', padding: '28px 20px 22px' }}>
        <div className="fs-sans a-fade-up" style={{ textAlign: 'center', fontSize: 13, color: def.color, letterSpacing: '0.18em', fontWeight: 800, textTransform: 'uppercase' }}>
          {def.icon} {eyebrow}
        </div>
        <div className="fs-display a-fade-up" dir="auto" style={{
          textAlign: 'center', animationDelay: '0.15s',
          fontSize: title && title.length > 28 ? 28 : 36,
          lineHeight: 1.08, letterSpacing: '-0.03em',
          fontWeight: 800, color: '#4A0E4E',
          marginTop: 8, marginBottom: sub ? 6 : 16,
          textShadow: '0 2px 0 rgba(255,255,255,0.65), 0 1px 3px rgba(74,14,78,0.12)',
          overflowWrap: 'break-word', wordBreak: 'break-word', padding: '0 8px',
        }}>
          {title}
        </div>
        {sub && (
          <div className="fs-mono a-fade-up" style={{
            textAlign: 'center', animationDelay: '0.2s',
            fontSize: 12, color: 'rgba(74,14,78,0.6)', marginBottom: 12,
          }}>
            {sub}
          </div>
        )}
        <div className="no-sb" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 9, minHeight: 0 }}>
          {rows.map((r, i) => renderRow(r, i, { isLast: !showOverflow && i === allRows.length - 1 && allRows.length > 1 }))}
          {showOverflow && !expanded && (
            <button onClick={() => setExpanded(true)} className="press" style={{
              background: 'none', border: 'none', cursor: 'pointer',
              textAlign: 'center', fontSize: 11, color: def.color,
              fontWeight: 700, letterSpacing: '0.12em', padding: '6px 0',
              width: '100%', animationDelay: `${0.4 + MAX_ROWS * 0.08}s`,
            }}>
              {moreLabel} ↓
            </button>
          )}
        </div>
      </div>
    </SlideShell>
  );
});

// Helper to convert hex color to RGB
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? `${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)}` : '0,0,0';
}

export default SlideMetricLeaderboard;
