import React from 'react';
import SlideShell from '../SlideShell.jsx';
import { useAnimatedNumber } from '../../hooks/useAnimatedNumber.js';
import { INK_SOFT, POS, NEG, fmtHour, cardStyle } from '../month/monthShared.jsx';
import { SEASON_THEMES } from '../../lib/seasonTheme.js';

// "Did X change over the season?" — a before→after read of this season vs the
// previous one (or first vs last month for collaboration). Shows both raw
// numbers, the direction, and a plain-language verdict.
function resolve(cfg, a) {
  const tr = a.season?.trends || {};
  const num = (v) => (v == null ? null : v);
  switch (cfg) {
    case 'activity': {
      const { cur, prev } = tr.activity || {};
      if (!prev) return null;
      return { prev, cur, fmt: (v) => v.toLocaleString(), dir: cur > prev ? 'up' : cur < prev ? 'down' : 'same', better: 'up' };
    }
    case 'earlier_later': {
      const { cur, prev } = tr.timeOfDay || {};
      if (num(cur) == null || num(prev) == null) return null;
      return { prev, cur, fmt: fmtHour, dir: cur < prev ? 'earlier' : cur > prev ? 'later' : 'same', better: null };
    }
    case 'media': {
      const { cur, prev } = tr.media || {};
      if (num(cur) == null || !a.season?.hasComparison) return null;
      return { prev, cur, fmt: (v) => `${Math.round(v)}%`, dir: cur > prev ? 'up' : cur < prev ? 'down' : 'same', better: null };
    }
    case 'response': {
      const { cur, prev } = tr.response || {};
      if (num(cur) == null || num(prev) == null) return null;
      const fmt = (v) => (v < 1 ? `${Math.round(v * 60)}s` : `${v.toFixed(1)}m`);
      return { prev, cur, fmt, dir: cur < prev ? 'faster' : cur > prev ? 'slower' : 'same', better: 'faster' };
    }
    case 'length': {
      const { cur, prev } = tr.convLen || {};
      if (num(cur) == null || num(prev) == null) return null;
      return { prev, cur, fmt: (v) => v.toFixed(1), dir: cur > prev ? 'longer' : cur < prev ? 'shorter' : 'same', better: null };
    }
    case 'collab': {
      const { firstSenders, lastSenders } = tr.collab || {};
      if (!firstSenders || (a.season?.months?.length || 0) < 2) return null;
      return { prev: firstSenders, cur: lastSenders, fmt: (v) => `${v}`, dir: lastSenders > firstSenders ? 'up' : lastSenders < firstSenders ? 'down' : 'same', better: 'up' };
    }
    default: return null;
  }
}

export function verdictHasData(cfg, a) { return resolve(cfg, a) != null; }

const SlideSeasonVerdict = React.memo(function SlideSeasonVerdict({ a, t, cfg = 'activity' }) {
  const theme = a.seasonTheme || SEASON_THEMES.spring;
  const r = resolve(cfg, a);
  if (!r) return null;
  const animatedCur = useAnimatedNumber(typeof r.cur === 'number' ? Math.round(r.cur * 10) : 0, 1200, [r.cur]);

  const eyebrow = t[`s3_v_${cfg}_eyebrow`] || 'THE SHIFT';
  const title = t[`s3_v_${cfg}_title`] || 'How the season changed';
  const verdict = t[`s3_v_${cfg}_${r.dir}`] || '';
  // colour the arrow by whether the direction is "good" when that's meaningful
  const arrowColor = r.better
    ? (r.dir === r.better ? POS : r.dir === 'same' ? INK_SOFT : NEG)
    : theme.accent;
  const arrow = r.dir === 'same' ? '▬' : '➜';

  void animatedCur;

  return (
    <SlideShell bg="#577590" accent={theme.accent}>
      <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', padding: '36px 24px 30px', alignItems: 'center' }}>
        <div className="fs-sans a-fade-up" dir="auto" style={{
          fontSize: 12, color: theme.accent, letterSpacing: '0.18em', fontWeight: 800, textTransform: 'uppercase', textAlign: 'center',
        }}>
          {eyebrow}
        </div>
        <div className="fs-display a-fade-up" dir="auto" style={{
          textAlign: 'center', animationDelay: '0.15s',
          fontSize: 26, lineHeight: 1.14, letterSpacing: '-0.02em',
          fontWeight: 800, color: '#2a0645', marginTop: 8, marginBottom: 26, padding: '0 6px',
          textShadow: '0 2px 0 rgba(255,255,255,0.6)',
        }}>
          {title}
        </div>

        {/* before → after */}
        <div className="a-fade-up" style={{ animationDelay: '0.3s', display: 'flex', alignItems: 'center', gap: 14, marginTop: 6 }}>
          <div style={{ ...cardStyle(false), padding: '16px 18px', textAlign: 'center', minWidth: 92 }}>
            <div className="fs-mono" style={{ fontSize: 10, color: INK_SOFT, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>
              {t.s3_v_before || 'last season'}
            </div>
            <div className="fs-display" style={{ fontSize: 30, fontWeight: 800, color: 'rgba(42,6,69,0.55)', marginTop: 4 }}>
              {r.fmt(r.prev)}
            </div>
          </div>
          <div className="fs-display" style={{ fontSize: 26, fontWeight: 900, color: arrowColor }} aria-hidden>{arrow}</div>
          <div style={{ ...cardStyle(true), padding: '16px 18px', textAlign: 'center', minWidth: 92 }}>
            <div className="fs-mono" style={{ fontSize: 10, color: INK_SOFT, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>
              {t.s3_v_after || 'this season'}
            </div>
            <div className="fs-display" style={{ fontSize: 34, fontWeight: 900, color: theme.accent, marginTop: 4 }}>
              {r.fmt(r.cur)}
            </div>
          </div>
        </div>

        {verdict && (
          <div className="a-fade-up" style={{
            marginTop: 'auto', textAlign: 'center',
            background: `${arrowColor}14`, borderRadius: 16, padding: '16px 18px', animationDelay: '0.7s',
          }}>
            <div className="fs-display" dir="auto" style={{ fontSize: 21, fontWeight: 800, color: '#2a0645', lineHeight: 1.2 }}>
              {verdict}
            </div>
          </div>
        )}
      </div>
    </SlideShell>
  );
});

export default SlideSeasonVerdict;
