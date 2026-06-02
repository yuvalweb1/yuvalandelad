import React from 'react';
import SlideShell from './SlideShell.jsx';
import ListSlideDecor from '../components/ListSlideDecor.jsx';
import { interp, typedCopy } from '../i18n';

const SlideGroupOverview = React.memo(function SlideGroupOverview({ a, t, profile }) {
  const type = profile?.relationship || 'other';
  const peakHour = (a.groupHourly && a.groupHourly.length)
    ? a.groupHourly.indexOf(Math.max(...a.groupHourly)) : null;
  const fmt = (d) => { try { return new Date(d).toLocaleDateString(undefined, { month: 'short', year: '2-digit' }); } catch { return ''; } };
  const range = `${fmt(a.start)} – ${fmt(a.end)}`;
  let peakDayStr = null, peakDayCount = null;
  if (a.peakDay) {
    const [date, count] = a.peakDay;
    const [yr, mo, dy] = date.split('-').map(Number);
    peakDayStr = new Date(yr, mo - 1, dy).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    peakDayCount = count;
  }
  const tiles = [
    { big: a.totalMessages.toLocaleString(), label: t.go_messages, icon: '💬', color: '#573280', tint: 'rgba(87,50,128,0.10)' },
    { big: String(a.totalParticipants), label: t.go_people, icon: '👥', color: '#f3722c', tint: 'rgba(243,114,44,0.10)' },
    { big: String(a.durationDays), label: t.go_days, icon: '📅', sub: range, color: '#277da1', tint: 'rgba(39,125,161,0.10)' },
    { big: peakHour != null ? `${String(peakHour).padStart(2, '0')}:00` : '—', label: t.go_peakhour, icon: '⏰', color: '#8338ec', tint: 'rgba(131,56,236,0.10)' },
  ];
  return (
    <SlideShell bg="#577590" accent="#573280">
      <ListSlideDecor emojis={['💬', '👥', '📅', '⏰', '🔥', '✨']} />
      <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column', padding: '36px 20px 20px' }}>
        <div className="fs-sans a-fade-up" style={{ textAlign: 'center', fontSize: 12, color: '#573280', letterSpacing: '0.18em', fontWeight: 800, textTransform: 'uppercase' }}>
          {typedCopy(t, 'go_eyebrow', type)}
        </div>
        <div className="fs-display a-fade-up" style={{
          textAlign: 'center', animationDelay: '0.15s',
          fontSize: 30, lineHeight: 1.12, letterSpacing: '-0.03em',
          fontWeight: 800, color: '#2a0645', marginTop: 8, marginBottom: 18,
          textShadow: '0 2px 0 rgba(255,255,255,0.65), 0 1px 3px rgba(42,6,69,0.1)',
          padding: '0 8px',
        }}>
          {typedCopy(t, 'go_title', type)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, flex: 1 }}>
          {tiles.map((tile, i) => (
            <div key={i} className="a-slide-up-far" style={{
              background: tile.tint,
              borderRadius: 24,
              boxShadow: `0 8px 28px -6px ${tile.color}30`,
              padding: '0 16px',
              textAlign: 'center',
              animationDelay: `${0.35 + i * 0.1}s`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
            }}>
              <div style={{ fontSize: 28, lineHeight: 1, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.12))' }}>{tile.icon}</div>
              <div className="fs-display" style={{
                fontSize: tile.big.length > 6 ? 30 : 40,
                fontWeight: 800, color: tile.color,
                letterSpacing: '-0.03em', lineHeight: 1, marginTop: 4,
              }}>
                {tile.big}
              </div>
              <div className="fs-sans" style={{
                fontSize: 11, color: 'rgba(42,6,69,0.6)',
                letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600,
              }}>
                {tile.label}
              </div>
              {tile.sub && (
                <div className="fs-mono" style={{ fontSize: 10, color: 'rgba(42,6,69,0.42)' }}>
                  {tile.sub}
                </div>
              )}
            </div>
          ))}
        </div>
        {peakDayStr && (
          <div className="a-fade-up" style={{
            animationDelay: '0.85s', marginTop: 12,
            background: 'rgba(243,114,44,0.10)',
            borderRadius: 20,
            boxShadow: '0 8px 28px -6px rgba(243,114,44,0.28)',
            padding: '14px 18px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap',
          }}>
            <span style={{ fontSize: 20 }}>🔥</span>
            <span className="fs-sans" style={{ fontSize: 11, color: '#f3722c', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>{t.go_busiest}</span>
            <span className="fs-display" style={{ fontSize: 20, fontWeight: 800, color: '#2a0645' }}>{peakDayStr}</span>
            <span className="fs-mono" style={{ fontSize: 13, color: 'rgba(42,6,69,0.55)' }}>· {interp(t.go_busiest_msgs, { n: peakDayCount.toLocaleString() })}</span>
          </div>
        )}
      </div>
    </SlideShell>
  );
})

export default SlideGroupOverview;
