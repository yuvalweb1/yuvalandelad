import React, { useState } from 'react';
import SlideShell from '../SlideShell.jsx';
import ListSlideDecor from '../../components/ListSlideDecor.jsx';
import { typedCopy } from '../../i18n';
import { LeaderRow, Eyebrow, Title, INK_SOFT } from './monthShared.jsx';
import { themedDecor } from '../../lib/seasonTheme.js';

// Sum of replies a person SENT to others (out) / RECEIVED from others (in),
// derived from the who-replied-to-whom matrix the base analytics already
// builds for the current window.
function repliesOut(a) {
  const out = {};
  const rm = a.replyMatrix || {};
  for (const from in rm) {
    let s = 0;
    for (const to in rm[from]) s += rm[from][to];
    out[from] = s;
  }
  return out;
}
function repliesIn(a) {
  const into = {};
  const rm = a.replyMatrix || {};
  for (const from in rm) {
    for (const to in rm[from]) into[to] = (into[to] || 0) + rm[from][to];
  }
  return into;
}

// Each def returns rows already sorted (rank 0 = winner). `value` drives the
// bar width; `displayValue` is what shows on the right.
const METRIC_DEFS = {
  chatterbox: {
    color: '#f3722c', icon: '👑', decor: ['👑', '💬', '🔥', '✨', '📣'],
    rows: (a) => (a.users || []).filter(u => u.messageCount > 0)
      .sort((x, y) => y.messageCount - x.messageCount)
      .map(u => ({ author: u.author, value: u.messageCount, displayValue: u.messageCount.toLocaleString() })),
  },
  maincharacter: {
    color: '#e05c8a', icon: '🌟', decor: ['🌟', '💬', '👀', '✨', '🎬'],
    rows: (a) => {
      const into = repliesIn(a);
      return (a.users || []).map(u => ({ u, n: into[u.author] || 0 }))
        .filter(x => x.n > 0)
        .sort((x, y) => y.n - x.n)
        .map(x => ({ author: x.u.author, value: x.n, displayValue: x.n.toLocaleString() }));
    },
  },
  supportive: {
    color: '#43aa8b', icon: '🤝', decor: ['🤝', '💬', '💚', '✨', '🫶'],
    rows: (a) => {
      const out = repliesOut(a);
      return (a.users || []).map(u => ({ u, n: out[u.author] || 0 }))
        .filter(x => x.n > 0)
        .sort((x, y) => y.n - x.n)
        .map(x => ({ author: x.u.author, value: x.n, displayValue: x.n.toLocaleString() }));
    },
  },
  photographer: {
    color: '#277da1', icon: '📸', decor: ['📸', '🖼️', '✨', '🌅', '📷'],
    rows: (a) => (a.users || []).filter(u => u.mediaCount > 0)
      .sort((x, y) => y.mediaCount - x.mediaCount)
      .map(u => ({ author: u.author, value: u.mediaCount, displayValue: u.mediaCount.toLocaleString() })),
  },
  memes: {
    color: '#f9456b', icon: '😂', decor: ['😂', '🖼️', '🔥', '✨', '📲'],
    rows: (a) => (a.users || []).filter(u => u.mediaCount > 0)
      .sort((x, y) => y.mediaCount - x.mediaCount)
      .map(u => ({ author: u.author, value: u.mediaCount, displayValue: u.mediaCount.toLocaleString() })),
  },
  voice: {
    color: '#f3722c', icon: '🎙️', decor: ['🎙️', '🔊', '🗣️', '✨', '📢'],
    rows: (a) => (a.users || []).filter(u => u.voiceCount > 0)
      .sort((x, y) => y.voiceCount - x.voiceCount)
      .map(u => ({ author: u.author, value: u.voiceCount, displayValue: u.voiceCount.toLocaleString() })),
  },
  links: {
    color: '#577590', icon: '🔗', decor: ['🔗', '🌐', '📎', '✨', '📰'],
    rows: (a) => (a.users || []).filter(u => u.linkCount > 0)
      .sort((x, y) => y.linkCount - x.linkCount)
      .map(u => ({ author: u.author, value: u.linkCount, displayValue: u.linkCount.toLocaleString() })),
  },
  night: {
    color: '#8338ec', icon: '🌙', decor: ['🌙', '⭐', '😴', '🛏️', '✨'],
    rows: (a) => (a.users || []).filter(u => u.nightMessages >= 1 && u.nightPct > 0)
      .sort((x, y) => y.nightPct - x.nightPct)
      .map(u => ({ author: u.author, value: u.nightPct, displayValue: `${u.nightPct.toFixed(0)}%` })),
  },
  speed: {
    color: '#277da1', icon: '⚡', decor: ['⚡', '🚀', '⏱️', '💨', '🎯'],
    rows: (a) => {
      const eligible = (a.users || []).filter(u => u.respSampleSize >= 3 && u.avgRespMin != null);
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
  starters: {
    color: '#577590', icon: '🚀', decor: ['🚀', '💬', '👋', '✨', '🔔'],
    rows: (a) => (a.users || []).filter(u => u.conversationsRevived > 0)
      .sort((x, y) => y.conversationsRevived - x.conversationsRevived)
      .map(u => ({ author: u.author, value: u.conversationsRevived, displayValue: u.conversationsRevived.toLocaleString() })),
  },
  comeback: {
    color: '#573280', icon: '🪦', decor: ['🪦', '👻', '💤', '✨', '🔙'],
    rows: (a) => (a.users || []).filter(u => u.longestAbsenceDays >= 1)
      .sort((x, y) => y.longestAbsenceDays - x.longestAbsenceDays)
      .map(u => ({ author: u.author, value: u.longestAbsenceDays, displayValue: `${u.longestAbsenceDays}d` })),
  },
};

export function monthLeaderboardHasData(metricKey, a) {
  const def = METRIC_DEFS[metricKey];
  if (!def) return false;
  return def.rows(a).length >= 1;
}

const MAX_ROWS = 5;

const SlideMonthLeaderboard = React.memo(function SlideMonthLeaderboard({ a, t, profile, metricKey }) {
  const def = METRIC_DEFS[metricKey];
  if (!def) return null;
  const allRows = def.rows(a);
  if (allRows.length === 0) return null;
  const [expanded, setExpanded] = useState(false);
  const overflow = allRows.length - MAX_ROWS;
  const showOverflow = overflow > 0 && !expanded;
  const rows = showOverflow ? allRows.slice(0, MAX_ROWS) : allRows;
  const moreLabel = (t.lb_more || '+{n} more').replace('{n}', overflow);
  const max = allRows[0]?.value || 1;

  const type = profile?.relationship || 'other';
  const eyebrow = typedCopy(t, `m4_${metricKey}_eyebrow`, type);
  const title = typedCopy(t, `m4_${metricKey}_title`, type);
  const sub = typedCopy(t, `m4_${metricKey}_sub`, type);

  return (
    <SlideShell bg={def.color} accent={def.color}>
      <ListSlideDecor emojis={themedDecor(def.decor, a.seasonTheme)} />
      <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column', padding: '28px 20px 22px' }}>
        <Eyebrow icon={def.icon} color={def.color}>{eyebrow}</Eyebrow>
        <Title size={title && title.length > 26 ? 28 : 34} style={{ marginTop: 8, marginBottom: sub ? 4 : 16 }}>
          {title}
        </Title>
        {sub && (
          <div className="fs-mono a-fade-up" style={{ textAlign: 'center', animationDelay: '0.2s', fontSize: 12, color: INK_SOFT, marginBottom: 16 }}>
            {sub}
          </div>
        )}
        <div className="no-sb" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 9, minHeight: 0 }}>
          {rows.map((r, i) => (
            <LeaderRow key={r.author} {...r} rank={i} max={max} color={def.color}
              accentBar={`${def.color}29`} />
          ))}
          {showOverflow && (
            <button onClick={() => setExpanded(true)} className="press" style={{
              background: 'none', border: 'none', cursor: 'pointer',
              textAlign: 'center', fontSize: 11, color: def.color,
              fontWeight: 700, letterSpacing: '0.12em', padding: '6px 0', width: '100%',
            }}>
              {moreLabel} ↓
            </button>
          )}
        </div>
      </div>
    </SlideShell>
  );
});

export default SlideMonthLeaderboard;
