import React, { useState } from 'react';
import SlideShell from '../SlideShell.jsx';
import ListSlideDecor from '../../components/ListSlideDecor.jsx';
import { typedCopy, isRtlText } from '../../i18n';
import { cardStyle, INK_SOFT, Eyebrow, Title } from '../month/monthShared.jsx';
import { themedDecor, SEASON_THEMES } from '../../lib/seasonTheme.js';

const MON_KEYS = ['mon_jan','mon_feb','mon_mar','mon_apr','mon_may','mon_jun','mon_jul','mon_aug','mon_sep','mon_oct','mon_nov','mon_dec'];
const ACCENT = '#8338ec';
const MAX_ROWS = 6;

export function memberMonthsHasData(a) {
  return (a.season?.peakMonthByUser || []).length >= 1 && (a.season?.months?.length || 0) >= 2;
}

// "Which month was each member most active" — a roster of who peaked when.
const SlideSeasonMemberMonths = React.memo(function SlideSeasonMemberMonths({ a, t, profile }) {
  const type = profile?.relationship || 'other';
  const theme = a.seasonTheme || SEASON_THEMES.spring;
  const all = a.season?.peakMonthByUser || [];
  if (all.length === 0) return null;
  const [expanded, setExpanded] = useState(false);
  const overflow = all.length - MAX_ROWS;
  const showOverflow = overflow > 0 && !expanded;
  const rows = showOverflow ? all.slice(0, MAX_ROWS) : all;
  const moreLabel = (t.lb_more || '+{n} more').replace('{n}', overflow);

  return (
    <SlideShell bg={ACCENT} accent={ACCENT}>
      <ListSlideDecor emojis={themedDecor(['📅', '👤', '⭐', '✨', '📊'], theme)} />
      <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column', padding: '28px 20px 22px' }}>
        <Eyebrow icon="📅" color="#573280">{t.s3_mm_eyebrow || 'PEAK MONTHS'}</Eyebrow>
        <Title size={30} style={{ marginTop: 8, marginBottom: 16 }}>
          {typedCopy(t, 's3_mm_title', type)}
        </Title>
        <div className="no-sb" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 9, minHeight: 0 }}>
          {rows.map((r, i) => {
            const nameLtr = !isRtlText(r.author);
            const monthName = t[MON_KEYS[r.monthIdx]] || '';
            return (
              <div key={r.author} className="a-slide-up-far" style={{
                ...cardStyle(i === 0), padding: '12px 16px', flexShrink: 0,
                display: 'flex', alignItems: 'center', gap: 10,
                direction: 'ltr', flexDirection: nameLtr ? 'row' : 'row-reverse',
                animationDelay: `${0.4 + i * 0.08}s`,
              }}>
                <div className="fs-sans" dir={nameLtr ? 'ltr' : 'rtl'} style={{
                  flex: 1, minWidth: 0, fontSize: 15, fontWeight: 700, color: '#4A0E4E',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  textAlign: nameLtr ? 'left' : 'right',
                }}>
                  {r.author}
                </div>
                <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, direction: 'ltr' }}>
                  <div className="fs-mono" style={{ fontSize: 11, color: INK_SOFT, fontWeight: 700 }}>
                    {r.count.toLocaleString()}
                  </div>
                  <div className="fs-display" style={{
                    fontSize: 13, fontWeight: 800, color: '#fff', background: ACCENT,
                    padding: '5px 12px', borderRadius: 999, letterSpacing: '0.02em',
                    boxShadow: `0 4px 10px ${ACCENT}55`,
                  }}>
                    {monthName}
                  </div>
                </div>
              </div>
            );
          })}
          {showOverflow && (
            <button onClick={() => setExpanded(true)} className="press" style={{
              background: 'none', border: 'none', cursor: 'pointer',
              textAlign: 'center', fontSize: 11, color: '#573280',
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

export default SlideSeasonMemberMonths;
