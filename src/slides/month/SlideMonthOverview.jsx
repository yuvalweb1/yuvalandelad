import React from 'react';
import SlideShell from '../SlideShell.jsx';
import ListSlideDecor from '../../components/ListSlideDecor.jsx';
import { useAnimatedNumber } from '../../hooks/useAnimatedNumber.js';
import { typedCopy } from '../../i18n';
import { DeltaChip, cardStyle, INK, INK_SOFT, dayName } from './monthShared.jsx';

const ACCENT = '#8338ec';

function StatTile({ icon, color, numValue, strValue, label, sub, delta, deltaLabel, delay }) {
  const animated = useAnimatedNumber(numValue != null ? numValue : 0, 1300, [numValue]);
  const display = strValue != null ? strValue : animated.toLocaleString();
  const len = String(display).length;
  return (
    <div className="a-slide-up-far" style={{
      ...cardStyle(false),
      animationDelay: delay,
      padding: '14px 12px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      textAlign: 'center', gap: 4, minHeight: 132,
    }}>
      <div style={{ fontSize: 22, lineHeight: 1 }}>{icon}</div>
      <div className="fs-display" dir="auto" style={{
        fontSize: len > 9 ? 24 : len > 6 ? 30 : 40, fontWeight: 900, color,
        letterSpacing: '-0.03em', lineHeight: 1,
        textShadow: `0 2px 0 rgba(255,255,255,0.7), 0 1px 10px ${color}22`,
      }}>
        {display}
      </div>
      <div className="fs-sans" style={{
        fontSize: 10, color: INK_SOFT, letterSpacing: '0.1em',
        textTransform: 'uppercase', fontWeight: 700, lineHeight: 1.25,
      }}>
        {label}
      </div>
      {sub && <div className="fs-mono" style={{ fontSize: 10, color: 'rgba(42,6,69,0.4)' }}>{sub}</div>}
      {delta != null && <DeltaChip pct={delta} label={deltaLabel} style={{ fontSize: 10, padding: '3px 8px', marginTop: 2 }} />}
    </div>
  );
}

// "Activity" section opener — 4 headline numbers for the month at a glance.
const SlideMonthOverview = React.memo(function SlideMonthOverview({ a, t, profile }) {
  const type = profile?.relationship || 'other';
  const m = a.monthly || {};

  let busyDayName = '—', busyDayCount = null;
  if (a.peakDay) {
    try {
      busyDayName = dayName(t, new Date(a.peakDay[0]).getDay());
      busyDayCount = a.peakDay[1];
    } catch { /* keep fallback */ }
  }

  const tiles = [
    {
      icon: '💬', color: '#8338ec', numValue: a.totalMessages,
      label: t.m4_ov_messages || 'messages', delta: m.growthPct, deltaLabel: t.m4_vs_last_short || 'vs last',
      delay: '0.3s',
    },
    {
      icon: '🔥', color: '#f3722c', strValue: busyDayName,
      label: typedCopy(t, 'm4_ov_busiest', type) || 'busiest day',
      sub: busyDayCount != null ? `${busyDayCount.toLocaleString()} ${t.m4_ov_msgs_short || 'msgs'}` : null,
      delay: '0.42s',
    },
    {
      icon: '📊', color: '#277da1', numValue: Math.round(m.avgPerDay || 0),
      label: t.m4_ov_per_day || 'msgs / day', delay: '0.54s',
    },
    {
      icon: '🤫', color: '#577590', numValue: a.longestSilenceDays || 0,
      label: t.m4_ov_quiet || 'longest quiet', sub: t.m4_ov_days || 'days', delay: '0.66s',
    },
  ];

  return (
    <SlideShell bg={ACCENT} accent={ACCENT}>
      <ListSlideDecor emojis={['💬', '🔥', '📊', '🤫', '✨', '📈']} />
      <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column', padding: '34px 20px calc(var(--safe-bottom) + 24px)' }}>
        <div className="fs-sans a-fade-up" dir="auto" style={{
          textAlign: 'center', fontSize: 13, color: '#573280',
          letterSpacing: '0.18em', fontWeight: 800, textTransform: 'uppercase',
        }}>
          📈 {t.m4_ov_eyebrow || 'Activity'}
        </div>
        <div className="fs-display a-fade-up" dir="auto" style={{
          textAlign: 'center', animationDelay: '0.15s',
          fontSize: 28, lineHeight: 1.1, letterSpacing: '-0.03em',
          fontWeight: 800, color: '#2a0645', marginTop: 8, marginBottom: 18,
          textShadow: '0 2px 0 rgba(255,255,255,0.65), 0 1px 3px rgba(42,6,69,0.1)',
          padding: '0 8px',
        }}>
          {typedCopy(t, 'm4_ov_title', type)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, flex: 1, alignContent: 'center' }}>
          {tiles.map((tile, i) => <StatTile key={i} {...tile} />)}
        </div>
      </div>
    </SlideShell>
  );
});

export default SlideMonthOverview;
