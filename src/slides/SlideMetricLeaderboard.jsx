import React, { useState } from 'react';
import SlideShell from './SlideShell.jsx';
import ListSlideDecor from '../components/ListSlideDecor.jsx';
import Twemoji from '../components/Twemoji.jsx';
import { typedCopy, isRtlText } from '../i18n';

// Metric definitions (same as SlideMetric, but rendered in leaderboard style)
const METRIC_DEFS = {
  double_texts: {
    color: '#f94144',
    icon: '💬',
    decorEmojis: ['💬', '🔥', '💕', '✨', '👀'],
    rows: (a) => (a.users || [])
      .filter(u => u.maxBurst >= 2)
      .sort((x, y) => y.maxBurst - x.maxBurst)
      .map(u => ({ author: u.author, value: u.maxBurst, displayValue: `${u.maxBurst}` })),
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
      }));
    },
  },
  overtime: {
    color: '#f94144',
    icon: '🕘',
    decorEmojis: ['🕘', '⏰', '💼', '😴', '✨'],
    rows: (a) => (a.users || [])
      .map(u => {
        // Off-hours = before 9 + after 18 (approximation — joint (hour,weekday) not stored)
        let off = 0;
        for (let h = 0; h < 24; h++) if (h < 9 || h >= 18) off += u.hourCounts[h];
        const pct = u.messageCount > 0 ? (off / u.messageCount) * 100 : 0;
        return { u, off, pct };
      })
      .filter(x => x.off >= 5)
      .sort((x, y) => y.pct - x.pct)
      .map(x => ({ author: x.u.author, value: x.pct, displayValue: `${x.pct.toFixed(0)}%` })),
  },
  night_messages: {
    color: '#8338ec',
    icon: '🌙',
    decorEmojis: ['🌙', '⭐', '😴', '🛏️', '✨'],
    rows: (a) => (a.users || [])
      .filter(u => u.nightPct > 0 && u.nightMessages >= 1)
      .sort((x, y) => y.nightPct - x.nightPct)
      .map(u => ({ author: u.author, value: u.nightPct, displayValue: `${u.nightPct.toFixed(0)}%` })),
  },
  signature_emoji: {
    color: '#f3722c',
    icon: '😊',
    decorEmojis: ['😊', '🎉', '💎', '✨', '🌟'],
    rows: (a) => (a.users || []).filter(u => u.topEmoji)
      .sort((x, y) => (y.topEmojiCount || 0) - (x.topEmojiCount || 0))
      .map(u => ({ author: u.author, value: u.topEmojiCount || 1, displayValue: u.topEmoji })),
  },
  night_owls: {
    color: '#8338ec',
    icon: '🌙',
    decorEmojis: ['🌙', '⭐', '😴', '🛏️', '✨'],
    rows: (a) => (a.users || [])
      .filter(u => u.nightPct > 0 && u.nightMessages >= 3)
      .sort((x, y) => y.nightPct - x.nightPct)
      .map(u => ({ author: u.author, value: u.nightPct, displayValue: `${u.nightPct.toFixed(0)}%` })),
  },
  ignored_award: {
    color: '#577590',
    icon: '👻',
    decorEmojis: ['👻', '💤', '🌙', '🤫', '✨'],
    rows: (a) => (a.users || [])
      .filter(u => u.longestAbsenceDays >= 1)
      .sort((x, y) => y.longestAbsenceDays - x.longestAbsenceDays)
      .map(u => ({ author: u.author, value: u.longestAbsenceDays, displayValue: `${u.longestAbsenceDays}d` })),
  },
  // Couple ("just us two") metrics
  messages_sent: {
    color: '#43aa8b',
    icon: '💬',
    decorEmojis: ['💬', '📊', '✍️', '✨', '📱'],
    rows: (a) => (a.users || [])
      .filter(u => u.messageCount > 0)
      .sort((x, y) => y.messageCount - x.messageCount)
      .map(u => ({ author: u.author, value: u.messageCount, displayValue: u.messageCount.toLocaleString() })),
  },
  conversation_starters: {
    color: '#577590',
    icon: '🚀',
    decorEmojis: ['🚀', '💬', '👋', '✨', '🔔'],
    rows: (a) => (a.users || [])
      .filter(u => u.conversationsRevived > 0)
      .sort((x, y) => y.conversationsRevived - x.conversationsRevived)
      .map(u => ({ author: u.author, value: u.conversationsRevived, displayValue: u.conversationsRevived.toLocaleString() })),
  },
  love_you: {
    color: '#f9456b',
    icon: '❤️',
    decorEmojis: ['❤️', '💕', '😍', '💞', '✨'],
    rows: (a) => (a.users || [])
      .filter(u => u.loveYouCount > 0)
      .sort((x, y) => y.loveYouCount - x.loveYouCount)
      .map(u => ({ author: u.author, value: u.loveYouCount, displayValue: u.loveYouCount.toLocaleString() })),
  },
};

export function metricHasData(metricKey, a) {
  const def = METRIC_DEFS[metricKey];
  if (!def) return false;
  return def.rows(a).length >= 1;
}

const MAX_ROWS = 5;

const SlideMetricLeaderboard = React.memo(function SlideMetricLeaderboard({ a, t, profile, metricKey, lang }) {
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

  const renderRow = (row, i) => {
    const isWinner = i === 0;
    // Layout is driven by the *name's* direction only — the app locale is
    // irrelevant. LTR name → name on the left, number + medal on the right.
    // RTL name → name on the right, number + medal on the left.
    const nameLtr = !isRtlText(row.author);
    const medal = i < 3 ? medals[i] : '⭐';

    const valueEl = (
      <div className="fs-display" style={{ flexShrink: 0, fontSize: 28, fontWeight: 800, color: def.color }}>
        <Twemoji>{row.displayValue}</Twemoji>
      </div>
    );

    const medalEl = (
      <div style={{ flexShrink: 0, fontSize: i < 3 ? 24 : 20, minWidth: 32, textAlign: 'center' }}>
        {medal}
      </div>
    );

    // number + medal kept together; medal sits on the card's outer edge.
    // direction:'ltr' forces row/row-reverse to be physical (left↔right),
    // unaffected by the ambient RTL UI direction in Hebrew/Arabic decks.
    const endGroup = (
      <div style={{
        flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8,
        direction: 'ltr',
        flexDirection: nameLtr ? 'row' : 'row-reverse',
      }}>
        {valueEl}
        {medalEl}
      </div>
    );

    const name = (
      <div className="fs-sans" dir={nameLtr ? 'ltr' : 'rtl'} style={{
        flex: 1, minWidth: 0, fontSize: 15, fontWeight: 700, color: '#4A0E4E',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        textAlign: nameLtr ? 'left' : 'right',
        paddingInline: 10,
      }}>
        {row.author}
      </div>
    );

    return (
      <div key={row.author} className="a-slide-up-far" style={{
        position: 'relative', padding: '12px 16px',
        background: isWinner ? '#FFF8E0' : '#fff',
        borderRadius: 18,
        border: `2px solid ${isWinner ? '#FFD700' : 'rgba(255,255,255,0.85)'}`,
        boxShadow: `0 6px 0 ${DEEP}22, 0 14px 24px -8px ${DEEP}55`,
        overflow: 'hidden', flexShrink: 0,
        animationDelay: `${0.4 + i * 0.08}s`,
      }}>
        {/* bar fill anchored to the number/medal side of the card */}
        <div className="a-slide-right" style={{
          position: 'absolute', top: 0, bottom: 0,
          [nameLtr ? 'right' : 'left']: 0,
          background: isWinner ? 'rgba(255,215,0,0.28)' : 'rgba(243,114,44,0.16)',
          width: `${Math.max(8, Math.round((row.value / (allRows[0]?.value || 1)) * 100))}%`,
          animationDelay: `${0.6 + i * 0.08}s`,
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'relative', display: 'flex', alignItems: 'center',
          direction: 'ltr',
          flexDirection: nameLtr ? 'row' : 'row-reverse',
        }}>
          {/* DOM order: name, endGroup. flexDirection mirrors it so the name
              and the number/medal group land on opposite edges per direction.
              direction:'ltr' keeps this physical regardless of the app locale. */}
          {name}
          {endGroup}
        </div>
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
          marginTop: 8, marginBottom: sub ? 4 : 16,
          textShadow: '0 2px 0 rgba(255,255,255,0.65), 0 1px 3px rgba(74,14,78,0.12)',
          overflowWrap: 'break-word', wordBreak: 'break-word', padding: '0 8px',
        }}>
          {title}
        </div>
        {sub && (
          <div className="fs-mono a-fade-up" style={{
            textAlign: 'center', animationDelay: '0.2s',
            fontSize: 12, color: 'rgba(74,14,78,0.55)', marginBottom: 16,
          }}>
            {sub}
          </div>
        )}
        <div className="no-sb" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 9, minHeight: 0 }}>
          {rows.map((r, i) => renderRow(r, i))}
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

export default SlideMetricLeaderboard;
