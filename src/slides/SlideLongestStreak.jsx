import React from 'react';
import SlideShell from './SlideShell.jsx';
import { typedCopy, interp } from '../i18n';
import { useAnimatedNumber } from '../hooks/useAnimatedNumber.js';

const SlideLongestStreak = React.memo(function SlideLongestStreak({ a, t, profile }) {
  const users = a.users || [];
  if (users.length === 0) return null;
  // For a couple chat the streak is shared (both have to message on the same day),
  // so the best-individual streak is a close proxy — pick the highest.
  const top = users.reduce((b, u) => (u.longestStreak > b.longestStreak ? u : b), users[0]);
  if (!top || top.longestStreak < 2) return null;

  const type = profile?.relationship || 'other';
  const eyebrow = typedCopy(t, 'ls_eyebrow', type);
  const title = typedCopy(t, 'ls_title', type);
  const unit = typedCopy(t, 'ls_unit', type);
  const sub = typedCopy(t, 'ls_sub', type);

  const animated = useAnimatedNumber(top.longestStreak, 1400, [top.author]);

  return (
    <SlideShell bg="#577590" accent="#f3722c">
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        textAlign: 'center', padding: '0 24px',
      }}>
        <div className="fs-sans a-fade-up" style={{
          fontSize: 12, color: '#f3722c', letterSpacing: '0.15em',
          fontWeight: 500, textTransform: 'uppercase',
        }}>
          {eyebrow}
        </div>
        <div className="fs-display a-fade-up" style={{
          animationDelay: '0.15s', marginTop: 12,
          fontSize: 28, lineHeight: 1.15, letterSpacing: '-0.03em',
          fontWeight: 800, color: '#2a0645',
        }}>
          {title}
        </div>
        <div className="a-spring" style={{ animationDelay: '0.45s', marginTop: 32 }}>
          <div className="fs-display" style={{
            fontSize: 120, lineHeight: 1, letterSpacing: '-0.05em',
            color: '#f3722c', fontWeight: 800,
          }}>
            {animated}
          </div>
          <div className="fs-mono" style={{
            fontSize: 16, color: 'rgba(42,6,69,0.7)',
            letterSpacing: '0.08em', textTransform: 'uppercase',
            marginTop: 8, fontWeight: 600,
          }}>
            {unit || 'days in a row'}
          </div>
        </div>
        {sub && (
          <div className="fs-sans a-fade-up" style={{
            animationDelay: '1.0s', marginTop: 28,
            fontSize: 16, lineHeight: 1.45, color: 'rgba(42,6,69,0.85)',
            padding: '0 8px',
          }}>
            {interp(sub, { name: top.author })}
          </div>
        )}
      </div>
    </SlideShell>
  );
});

export default SlideLongestStreak;
