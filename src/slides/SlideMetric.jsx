import React from 'react';
import SlideShell from './SlideShell.jsx';
import { typedCopy, interp } from '../i18n';

// Each metric def returns an array of { author, value, displayValue, sub? }
// already sorted in display order (rank 1 first). The renderer scales bar widths
// off rows[0].value so "biggest bar = winner of this metric" stays consistent
// across stats where higher is better AND inverted stats (response_times).
const METRIC_DEFS = {
  night_owls: {
    color: '#8338ec',
    bg: '#577590',
    icon: '🌙',
    rows: (a) => (a.users || [])
      .filter(u => u.nightPct > 0 && u.nightMessages >= 3)
      .sort((x, y) => y.nightPct - x.nightPct)
      .map(u => ({ author: u.author, value: u.nightPct, displayValue: `${u.nightPct.toFixed(0)}%`, sub: `${u.nightMessages.toLocaleString()} msgs 0–6am` })),
  },
  early_birds: {
    color: '#f9c74f',
    bg: '#577590',
    icon: '🌅',
    rows: (a) => (a.users || [])
      .filter(u => u.morningMessages >= 3)
      .sort((x, y) => y.morningMessages - x.morningMessages)
      .map(u => ({ author: u.author, value: u.morningMessages, displayValue: u.morningMessages.toLocaleString(), sub: `peak ${String(u.peakHour).padStart(2,'0')}:00` })),
  },
  voice_notes_leader: {
    color: '#f3722c',
    bg: '#577590',
    icon: '🎙️',
    rows: (a) => (a.users || [])
      .filter(u => u.voiceCount > 0)
      .sort((x, y) => y.voiceCount - x.voiceCount)
      .map(u => ({ author: u.author, value: u.voiceCount, displayValue: u.voiceCount.toLocaleString(), sub: `${(u.voiceRate * 100).toFixed(0)}% of their msgs` })),
  },
  overtime: {
    color: '#f94144',
    bg: '#577590',
    icon: '🕘',
    rows: (a) => {
      // Off-hours = before 9 + after 18 (approximation — joint (hour,weekday) not stored)
      return (a.users || [])
        .map(u => {
          let off = 0;
          for (let h = 0; h < 24; h++) if (h < 9 || h >= 18) off += u.hourCounts[h];
          const pct = u.messageCount > 0 ? (off / u.messageCount) * 100 : 0;
          return { u, off, pct };
        })
        .filter(x => x.off >= 5)
        .sort((x, y) => y.pct - x.pct)
          .map(x => ({ author: x.u.author, value: x.pct, displayValue: `${x.pct.toFixed(0)}%`, sub: `${x.off.toLocaleString()} off-hours msgs` }));
    },
  },
  response_times: {
    color: '#277da1',
    bg: '#577590',
    icon: '⚡',
    rows: (a) => {
      const eligible = (a.users || []).filter(u => u.respSampleSize >= 5 && u.avgRespMin != null);
      if (eligible.length === 0) return [];
      const sorted = [...eligible].sort((x, y) => x.avgRespMin - y.avgRespMin);
      const slowest = sorted[sorted.length - 1].avgRespMin;
      return sorted.map(u => ({
        author: u.author,
        value: slowest - u.avgRespMin + 0.5,
        displayValue: u.avgRespMin < 1 ? `${Math.round(u.avgRespMin * 60)}s` : `${u.avgRespMin.toFixed(1)}m`,
        sub: `${u.respSampleSize.toLocaleString()} replies`,
      }));
    },
  },
  essay_writers: {
    color: '#8338ec',
    bg: '#577590',
    icon: '📝',
    rows: (a) => (a.users || [])
      .filter(u => u.messageCount >= 20)
      .sort((x, y) => y.avgCharsPerMsg - x.avgCharsPerMsg)
      .map(u => ({ author: u.author, value: u.avgCharsPerMsg, displayValue: `${Math.round(u.avgCharsPerMsg)}c`, sub: `${u.avgWordsPerMsg.toFixed(1)} words/msg` })),
  },
  link_sharers: {
    color: '#277da1',
    bg: '#577590',
    icon: '🔗',
    rows: (a) => (a.users || [])
      .filter(u => u.linkCount > 0)
      .sort((x, y) => y.linkCount - x.linkCount)
      .map(u => ({ author: u.author, value: u.linkCount, displayValue: u.linkCount.toLocaleString(), sub: 'links shared' })),
  },
  double_texts: {
    color: '#f94144',
    bg: '#577590',
    icon: '💬',
    rows: (a) => (a.users || [])
      .filter(u => u.maxBurst >= 2)
      .sort((x, y) => y.maxBurst - x.maxBurst)
      .map(u => ({ author: u.author, value: u.maxBurst, displayValue: `${u.maxBurst}×`, sub: 'in a row' })),
  },
  ignored_award: {
    color: '#2a0645',
    bg: '#577590',
    icon: '👻',
    rows: (a) => (a.users || [])
      .filter(u => u.longestAbsenceDays >= 1)
      .sort((x, y) => y.longestAbsenceDays - x.longestAbsenceDays)
      .map(u => ({ author: u.author, value: u.longestAbsenceDays, displayValue: `${u.longestAbsenceDays}d`, sub: 'silent stretch' })),
  },
  night_messages: {
    color: '#8338ec',
    bg: '#577590',
    icon: '🌙',
    rows: (a) => (a.users || [])
      .filter(u => u.nightPct > 0 && u.nightMessages >= 1)
      .sort((x, y) => y.nightPct - x.nightPct)
      .map(u => ({ author: u.author, value: u.nightPct, displayValue: `${u.nightPct.toFixed(0)}%`, sub: `${u.nightMessages.toLocaleString()} late msgs` })),
  },
};

export function metricHasData(metricKey, a) {
  const def = METRIC_DEFS[metricKey];
  if (!def) return false;
  return def.rows(a).length >= 1;
}

const SlideMetric = React.memo(function SlideMetric({ a, t, profile, metricKey }) {
  const def = METRIC_DEFS[metricKey];
  if (!def) return null;
  const rows = def.rows(a);
  if (rows.length === 0) return null;

  const type = profile?.relationship || 'other';
  const eyebrow = typedCopy(t, `m_${metricKey}_eyebrow`, type);
  const title = typedCopy(t, `m_${metricKey}_title`, type);
  const sub = typedCopy(t, `m_${metricKey}_sub`, type);

  const maxVal = Math.max(...rows.map(r => r.value), 0.001);
  const medals = ['🥇', '🥈', '🥉'];

  return (
    <SlideShell bg={def.bg} accent={def.color}>
      <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', padding: '32px 22px 22px' }}>
        <div className="fs-sans a-fade-up" style={{
          textAlign: 'center', fontSize: 12, color: def.color, letterSpacing: '0.15em',
          fontWeight: 500, textTransform: 'uppercase',
        }}>
          {def.icon} {eyebrow}
        </div>
        <div className="fs-display a-fade-up" style={{
          textAlign: 'center', animationDelay: '0.15s',
          fontSize: title && title.length > 28 ? 26 : 30,
          lineHeight: 1.12, letterSpacing: '-0.03em', fontWeight: 800,
          color: '#2a0645', marginTop: 8, marginBottom: sub ? 4 : 16,
          padding: '0 8px',
        }}>
          {title}
        </div>
        {sub && (
          <div className="fs-mono a-fade-up" style={{
            textAlign: 'center', animationDelay: '0.2s',
            fontSize: 12, color: 'rgba(42,6,69,0.55)', marginBottom: 16,
          }}>
            {sub}
          </div>
        )}
        <div className="no-sb" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0, paddingBottom: 12 }}>
          {rows.map((r, i) => {
            const pct = Math.max(8, Math.round((r.value / maxVal) * 100));
            return (
              <div key={r.author} dir="auto" className="a-slide-up-far" style={{
                position: 'relative', padding: '12px 16px',
                background: i === 0 ? `${def.color}1f` : 'rgba(42,6,69,0.06)',
                borderRadius: 14, overflow: 'hidden',
                animationDelay: `${0.4 + i * 0.08}s`,
              }}>
                <div className="a-slide-right" style={{
                  position: 'absolute', top: 0, bottom: 0, insetInlineStart: 0,
                  background: `linear-gradient(90deg, ${def.color}28 0%, ${def.color}05 100%)`,
                  width: `${pct}%`,
                  animationDelay: `${0.55 + i * 0.08}s`,
                  pointerEvents: 'none',
                }} />
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="fs-display" style={{
                    width: 26, flexShrink: 0, fontSize: i < 3 ? 20 : 14,
                    textAlign: 'center', color: 'rgba(42,6,69,0.55)',
                  }}>
                    {i < 3 ? medals[i] : i + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="fs-sans" style={{
                      fontSize: 15, fontWeight: 700, color: '#2a0645',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {r.author}
                    </div>
                    {r.sub && (
                      <div className="fs-mono" style={{
                        marginTop: 2, fontSize: 11, color: 'rgba(42,6,69,0.55)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {r.sub}
                      </div>
                    )}
                  </div>
                  <div className="fs-mono" style={{
                    flexShrink: 0, fontSize: 16, fontWeight: 800, color: def.color,
                  }}>
                    {r.displayValue}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SlideShell>
  );
});

export default SlideMetric;
