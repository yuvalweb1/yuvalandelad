import React, { useState } from 'react';
import SlideShell from '../SlideShell.jsx';
import ListSlideDecor from '../../components/ListSlideDecor.jsx';
import { interp } from '../../i18n';
import { LeaderRow, Eyebrow, Title } from '../month/monthShared.jsx';
import { themedDecor, SEASON_THEMES } from '../../lib/seasonTheme.js';

// Who climbed / who faded across the season — ranked by the change in monthly
// volume from the first month to the last. Raw "first → last" shown per row.
const CFG = {
  risers:  { color: '#1a8754', icon: '📈', decor: ['📈', '🚀', '🔥', '✨', '⬆️'], src: (s) => s.risers },
  fallers: { color: '#e5484d', icon: '📉', decor: ['📉', '💨', '🍂', '✨', '⬇️'], src: (s) => s.fallers },
};

export function moversHasData(cfg, a) {
  const def = CFG[cfg]; if (!def) return false;
  return (def.src(a.season || {}) || []).length >= 1;
}

const MAX_ROWS = 5;

const SlideSeasonMovers = React.memo(function SlideSeasonMovers({ a, t, cfg = 'risers' }) {
  const def = CFG[cfg]; if (!def) return null;
  const theme = a.seasonTheme || SEASON_THEMES.spring;
  const all = def.src(a.season || {}) || [];
  if (all.length === 0) return null;
  const [expanded, setExpanded] = useState(false);
  const overflow = all.length - MAX_ROWS;
  const showOverflow = overflow > 0 && !expanded;
  const rows = showOverflow ? all.slice(0, MAX_ROWS) : all;
  const moreLabel = (t.lb_more || '+{n} more').replace('{n}', overflow);
  const max = Math.abs(all[0]?.delta) || 1;

  return (
    <SlideShell bg={def.color} accent={def.color}>
      <ListSlideDecor emojis={themedDecor(def.decor, theme)} />
      <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column', padding: '28px 20px 22px' }}>
        <Eyebrow icon={def.icon} color={def.color}>{t[`s3_movers_${cfg}_eyebrow`] || (cfg === 'risers' ? 'ON THE RISE' : 'FADING OUT')}</Eyebrow>
        <Title size={32} style={{ marginTop: 8, marginBottom: 16 }}>
          {t[`s3_movers_${cfg}_title`] || (cfg === 'risers' ? 'Biggest comeback in activity' : 'Who slowly disappeared')}
        </Title>
        <div className="no-sb" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 9, minHeight: 0 }}>
          {rows.map((r, i) => (
            <LeaderRow key={r.author}
              author={r.author}
              value={Math.abs(r.delta)}
              max={max}
              rank={i}
              color={def.color}
              accentBar={`${def.color}26`}
              displayValue={`${r.delta > 0 ? '+' : '−'}${Math.abs(r.delta)}`}
              sub={interp(t.s3_movers_row || '{a} → {b} per month', { a: r.first, b: r.last })}
            />
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

export default SlideSeasonMovers;
