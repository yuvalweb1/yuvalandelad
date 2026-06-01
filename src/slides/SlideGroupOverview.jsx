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
    { big: a.totalMessages.toLocaleString(), label: t.go_messages, color: '#573280' },
    { big: String(a.totalParticipants), label: t.go_people, color: '#f3722c' },
    { big: String(a.durationDays), label: t.go_days, sub: range, color: '#277da1' },
    { big: peakHour != null ? `${String(peakHour).padStart(2, '0')}:00` : '—', label: t.go_peakhour, color: '#8338ec' },
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
              background: '#fff',
              borderRadius: 20,
              border: '2px solid rgba(255,255,255,0.85)',
              boxShadow: `0 6px 0 ${tile.color}22, 0 14px 24px -8px ${tile.color}44`,
              padding: '0 16px',
              textAlign: 'center',
              animationDelay: `${0.35 + i * 0.1}s`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              position: 'relative', overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: 4,
                background: tile.color, borderRadius: '18px 18px 0 0',
              }} />
              <div className="fs-display" style={{
                fontSize: tile.big.length > 6 ? 30 : 38,
                fontWeight: 800, color: tile.color,
                letterSpacing: '-0.03em', lineHeight: 1,
              }}>
                {tile.big}
              </div>
              <div className="fs-sans" style={{
                marginTop: 8, fontSize: 11, color: 'rgba(42,6,69,0.6)',
                letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600,
              }}>
                {tile.label}
              </div>
              {tile.sub && (
                <div className="fs-mono" style={{ marginTop: 5, fontSize: 10, color: 'rgba(42,6,69,0.45)' }}>
                  {tile.sub}
                </div>
              )}
            </div>
          ))}
        </div>
        {peakDayStr && (
          <div className="a-fade-up" style={{
            animationDelay: '0.85s', marginTop: 12,
            background: '#fff',
            borderRadius: 18,
            border: '2px solid rgba(255,255,255,0.85)',
            boxShadow: '0 6px 0 rgba(243,114,44,0.18), 0 14px 24px -8px rgba(243,114,44,0.38)',
            padding: '14px 18px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap',
          }}>
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
