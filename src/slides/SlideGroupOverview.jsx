import React from 'react';
import SlideShell from './SlideShell.jsx';
import { interp } from '../i18n';

const SlideGroupOverview = React.memo(function SlideGroupOverview({ a, t }) {
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
      <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', padding: '36px 24px 24px' }}>
        <div className="fs-sans a-fade-up" style={{ textAlign: 'center', fontSize: 12, color: '#573280', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase' }}>{t.go_eyebrow}</div>
        <div className="fs-display a-fade-up" style={{ textAlign: 'center', animationDelay: '0.15s', fontSize: 30, lineHeight: 1.12, letterSpacing: '-0.03em', fontWeight: 800, color: '#2a0645', marginTop: 8, marginBottom: 18 }}>{t.go_title}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {tiles.map((tile, i) => (
            <div key={i} className="a-slide-up-far" style={{ background: 'rgba(42,6,69,0.06)', borderRadius: 18, padding: '18px 16px', textAlign: 'center', animationDelay: `${0.4 + i * 0.12}s` }}>
              <div className="fs-display" style={{ fontSize: tile.big.length > 6 ? 28 : 34, fontWeight: 800, color: tile.color, letterSpacing: '-0.03em', lineHeight: 1 }}>{tile.big}</div>
              <div className="fs-sans" style={{ marginTop: 6, fontSize: 12, color: 'rgba(42,6,69,0.7)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 500 }}>{tile.label}</div>
              {tile.sub && <div className="fs-mono" style={{ marginTop: 4, fontSize: 11, color: 'rgba(42,6,69,0.55)' }}>{tile.sub}</div>}
            </div>
          ))}
        </div>
        {peakDayStr && (
          <div className="a-fade-up" style={{ animationDelay: '0.9s', marginTop: 14, textAlign: 'center', background: 'rgba(243,114,44,0.1)', borderRadius: 16, padding: '14px 16px' }}>
            <span className="fs-sans" style={{ fontSize: 12, color: '#f3722c', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>{t.go_busiest} </span>
            <span className="fs-display" style={{ fontSize: 18, fontWeight: 800, color: '#2a0645' }}>{peakDayStr}</span>
            <span className="fs-mono" style={{ fontSize: 13, color: 'rgba(42,6,69,0.6)' }}> · {interp(t.go_busiest_msgs, { n: peakDayCount.toLocaleString() })}</span>
          </div>
        )}
      </div>
    </SlideShell>
  );
})

export default SlideGroupOverview;
