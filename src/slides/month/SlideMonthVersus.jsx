import React from 'react';
import SlideShell from '../SlideShell.jsx';
import { useAnimatedNumber } from '../../hooks/useAnimatedNumber.js';
import { INK_SOFT } from './monthShared.jsx';

// Head-to-head split between two slices of the month.
//   work_after       → working hours (9–18) vs after-hours
//   weekday_weekend  → weekdays vs weekend (Fri/Sat)
//   gm_gn            → "good morning" vs "good night" texts
const CFG = {
  work_after:      { bg: '#577590', left: '#277da1', right: '#f3722c', lIcon: '💼', rIcon: '🌆' },
  weekday_weekend: { bg: '#573280', left: '#8338ec', right: '#f9456b', lIcon: '🗓️', rIcon: '🎉' },
  gm_gn:           { bg: '#573280', left: '#f9c74f', right: '#8338ec', lIcon: '🌅', rIcon: '🌙' },
  // season "personality" splits (read base analytics, scope-neutral)
  media_text:      { bg: '#573280', left: '#f9456b', right: '#43aa8b', lIcon: '😂', rIcon: '💬' },
  voice_text:      { bg: '#577590', left: '#f3722c', right: '#43aa8b', lIcon: '🎙️', rIcon: '💬' },
  night_day:       { bg: '#2a0645', left: '#8338ec', right: '#f9c74f', lIcon: '🌙', rIcon: '☀️' },
};

function sumField(a, field) {
  return (a.users || []).reduce((s, u) => s + (u[field] || 0), 0);
}

function values(cfg, a) {
  const m = a.monthly || {};
  if (cfg === 'gm_gn') return [m.gmCount || 0, m.gnCount || 0];
  if (cfg === 'weekday_weekend') {
    if (m.weekdayMsgs != null) return [m.weekdayMsgs, m.weekendMsgs];
    const w = a.groupWeekly || [];
    const weekend = (w[5] || 0) + (w[6] || 0);
    return [w.reduce((s, v) => s + v, 0) - weekend, weekend];
  }
  if (cfg === 'media_text') {
    const media = sumField(a, 'mediaCount');
    const voice = sumField(a, 'voiceCount');
    const text = Math.max(0, (a.totalMessages || 0) - media - voice);
    return [media, text];
  }
  if (cfg === 'voice_text') {
    const voice = sumField(a, 'voiceCount');
    const media = sumField(a, 'mediaCount');
    const text = Math.max(0, (a.totalMessages || 0) - media - voice);
    return [voice, text];
  }
  if (cfg === 'night_day') {
    const h = a.groupHourly || [];
    let night = 0; for (const x of [22, 23, 0, 1, 2, 3, 4, 5]) night += h[x] || 0;
    const total = h.reduce((s, v) => s + v, 0);
    return [night, Math.max(0, total - night)];
  }
  // work_after
  const h = a.groupHourly || [];
  let work = 0; for (let i = 9; i < 18; i++) work += h[i] || 0;
  const after = h.reduce((s, v) => s + v, 0) - work;
  return [work, after];
}

export function versusHasData(cfg, a) {
  const [l, r] = values(cfg, a);
  return (l + r) > 0;
}

const SlideMonthVersus = React.memo(function SlideMonthVersus({ a, t, cfg = 'work_after' }) {
  const c = CFG[cfg] || CFG.work_after;
  const [lVal, rVal] = values(cfg, a);
  const sum = lVal + rVal;
  if (sum <= 0) return null;
  const lPct = Math.round((lVal / sum) * 100);
  const rPct = 100 - lPct;
  const lAnim = useAnimatedNumber(lVal, 1300, [lVal]);
  const rAnim = useAnimatedNumber(rVal, 1300, [rVal]);

  const leftWins = lVal >= rVal;
  const verdict = leftWins ? t[`m4_vs_${cfg}_win_left`] : t[`m4_vs_${cfg}_win_right`];

  const Cell = ({ icon, label, value, color, align }) => (
    <div style={{ flex: 1, textAlign: align }}>
      <div style={{ fontSize: 26, lineHeight: 1 }}>{icon}</div>
      <div className="fs-display" style={{ fontSize: 38, fontWeight: 900, color, letterSpacing: '-0.03em', marginTop: 4, lineHeight: 1 }}>
        {value.toLocaleString()}
      </div>
      <div className="fs-sans" dir="auto" style={{ fontSize: 11, color: INK_SOFT, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 4 }}>
        {label}
      </div>
    </div>
  );

  return (
    <SlideShell bg={c.bg} accent={c.left}>
      <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', padding: '34px 22px 26px' }}>
        <div className="fs-sans a-fade-up" dir="auto" style={{
          textAlign: 'center', fontSize: 12, color: c.left, letterSpacing: '0.15em',
          fontWeight: 700, textTransform: 'uppercase',
        }}>
          {t[`m4_vs_${cfg}_eyebrow`] || 'Head to head'}
        </div>
        <div className="fs-display a-fade-up" dir="auto" style={{
          textAlign: 'center', animationDelay: '0.15s',
          fontSize: 28, lineHeight: 1.12, letterSpacing: '-0.03em',
          fontWeight: 800, color: '#2a0645', marginTop: 8, marginBottom: 28, padding: '0 8px',
        }}>
          {t[`m4_vs_${cfg}_title`] || 'This vs that'}
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 18 }}>
          <Cell icon={c.lIcon} label={t[`m4_vs_${cfg}_left`] || 'A'} value={lAnim} color={c.left} align="left" />
          <div className="fs-display" style={{ fontSize: 18, color: 'rgba(42,6,69,0.4)', fontWeight: 800, alignSelf: 'center' }}>VS</div>
          <Cell icon={c.rIcon} label={t[`m4_vs_${cfg}_right`] || 'B'} value={rAnim} color={c.right} align="right" />
        </div>

        {/* proportional split bar */}
        <div style={{ display: 'flex', height: 26, borderRadius: 999, overflow: 'hidden', boxShadow: '0 6px 14px -6px rgba(42,6,69,0.4)' }}>
          <div className="a-slide-right" style={{ width: `${lPct}%`, background: c.left, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {lPct >= 18 && <span className="fs-mono" style={{ fontSize: 11, fontWeight: 800, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>{lPct}%</span>}
          </div>
          <div style={{ width: `${rPct}%`, background: c.right, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {rPct >= 18 && <span className="fs-mono" style={{ fontSize: 11, fontWeight: 800, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>{rPct}%</span>}
          </div>
        </div>

        {verdict && (
          <div className="a-fade-up" style={{
            marginTop: 'auto', textAlign: 'center',
            background: `${(leftWins ? c.left : c.right)}1a`, borderRadius: 16, padding: '14px 16px',
            animationDelay: '0.8s',
          }}>
            <div className="fs-display" dir="auto" style={{ fontSize: 20, fontWeight: 800, color: '#2a0645', lineHeight: 1.2 }}>
              {verdict}
            </div>
          </div>
        )}
      </div>
    </SlideShell>
  );
});

export default SlideMonthVersus;
