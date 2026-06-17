import React from 'react';
import SlideShell from '../SlideShell.jsx';
import MedalCoin from '../../components/MedalCoin.jsx';
import { interp, typedCopy } from '../../i18n';

// Month-scaled award winners. Computed here (not from the year-scale
// superlatives in computeAll) so the thresholds make sense over a 28-day
// window — a "Speed Demon" needs only a handful of replies, not 10+.
function argmax(arr, fn, min = -Infinity) {
  let best = null, bestV = min;
  for (const x of arr) { const v = fn(x); if (v > bestV) { bestV = v; best = x; } }
  return best;
}

const SlideMonthAwards = React.memo(function SlideMonthAwards({ a, t, profile }) {
  const type = profile?.relationship || 'other';
  const users = a.users || [];

  const champ = argmax(users, u => u.messageCount, 0);
  const ghost = argmax(users.filter(u => u.longestAbsenceDays >= 1), u => u.longestAbsenceDays);
  const meme = argmax(users.filter(u => u.mediaCount > 0), u => u.mediaCount);
  const night = argmax(users.filter(u => u.nightMessages >= 1 && u.nightPct > 0), u => u.nightPct);
  const speedPool = users.filter(u => u.respSampleSize >= 3 && u.avgRespMin != null);
  const speed = speedPool.length ? speedPool.reduce((b, u) => (u.avgRespMin < b.avgRespMin ? u : b)) : null;

  const awards = [
    champ && champ.messageCount > 0 && {
      key: 'champ', emoji: '🗣️', accent: '#f3722c',
      label: t.m4_award_champ || 'Yap Champion', winner: champ.author,
      sub: interp(t.m4_award_champ_sub || '{n} messages', { n: champ.messageCount.toLocaleString() }),
    },
    ghost && {
      key: 'ghost', emoji: '👻', accent: '#573280',
      label: t.m4_award_ghost || 'The Ghost', winner: ghost.author,
      sub: interp(t.m4_award_ghost_sub || '{n}d off the grid', { n: ghost.longestAbsenceDays }),
    },
    meme && {
      key: 'meme', emoji: '😂', accent: '#f9456b',
      label: t.m4_award_meme || 'Meme Dealer', winner: meme.author,
      sub: interp(t.m4_award_meme_sub || '{n} media drops', { n: meme.mediaCount.toLocaleString() }),
    },
    night && {
      key: 'night', emoji: '🌙', accent: '#8338ec',
      label: t.m4_award_night || 'Night Owl', winner: night.author,
      sub: interp(t.m4_award_night_sub || '{pct}% after dark', { pct: night.nightPct.toFixed(0) }),
    },
    speed && {
      key: 'speed', emoji: '⚡', accent: '#277da1',
      label: t.m4_award_speed || 'Speed Demon', winner: speed.author,
      sub: speed.avgRespMin < 1
        ? interp(t.m4_award_speed_sub_s || '{s}s avg reply', { s: Math.round(speed.avgRespMin * 60) })
        : interp(t.m4_award_speed_sub || '{m}m avg reply', { m: speed.avgRespMin.toFixed(1) }),
    },
  ].filter(Boolean);

  return (
    <SlideShell accent="#f9c74f">
      <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', padding: '30px 20px 16px' }}>
        <div style={{ textAlign: 'center', flexShrink: 0 }}>
          <div className="fs-sans a-fade-up" style={{
            fontSize: 13, color: '#b87a00', letterSpacing: '0.18em',
            fontWeight: 800, textTransform: 'uppercase',
          }}>
            🏆 {t.m4_awards_eyebrow || 'This month’s winners'}
          </div>
          <div className="fs-display a-fade-up" dir="auto" style={{
            animationDelay: '0.12s', fontSize: 28, lineHeight: 1.06, marginTop: 6,
            fontWeight: 800, letterSpacing: '-0.03em', color: '#2a0645',
            textShadow: '0 2px 0 rgba(255,255,255,0.65), 0 1px 3px rgba(42,6,69,0.1)',
          }}>
            {typedCopy(t, 'm4_awards_title', type)}
          </div>
        </div>

        <div style={{
          marginTop: 16, flex: 1, alignContent: 'center',
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
        }}>
          {awards.map((aw, i) => (
            <div key={aw.key} className="a-pop-in" style={{
              animationDelay: `${0.3 + i * 0.07}s`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
              ...(awards.length % 2 === 1 && i === awards.length - 1 ? { gridColumn: '1 / -1' } : {}),
            }}>
              <MedalCoin accent={aw.accent} emoji={aw.emoji} size={76} emojiSize={31} shineDur={4 + i * 0.4} shineDelay={i * 0.5} />
              <div className="fs-mono" style={{
                fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase',
                fontWeight: 700, color: aw.accent, marginTop: 9, lineHeight: 1.35,
                overflowWrap: 'break-word', wordBreak: 'break-word', padding: '0 4px',
              }}>
                {aw.label}
              </div>
              <div className="fs-display" dir="auto" style={{
                fontSize: 15, marginTop: 2, color: '#2a0645', maxWidth: '100%',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {aw.winner}
              </div>
              <div className="fs-mono" style={{ fontSize: 10, color: 'rgba(42,6,69,0.7)', marginTop: 1 }}>
                {aw.sub}
              </div>
            </div>
          ))}
        </div>
      </div>
    </SlideShell>
  );
});

export default SlideMonthAwards;
