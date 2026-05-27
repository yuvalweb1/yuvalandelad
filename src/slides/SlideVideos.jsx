import React, { useState } from 'react';
import SlideShell from './SlideShell.jsx';
import ListSlideDecor from '../components/ListSlideDecor.jsx';
import { interp } from '../i18n';

const fmtMB = (bytes) => (bytes / (1024 * 1024)).toFixed(1) + ' MB';

const MAX_ROWS = 2;

const SlideVideos = React.memo(function SlideVideos({ a, t }) {
  const allList = a.videos || [];
  if (allList.length === 0) return null;
  const [expanded, setExpanded] = useState(false);
  const overflow = allList.length - MAX_ROWS;
  const showOverflow = overflow > 0 && !expanded;
  const list = showOverflow ? allList.slice(0, MAX_ROWS) : allList;
  const moreLabel = (t.lb_more || '+{n} more').replace('{n}', overflow);
  return (
    <SlideShell bg="#577590" accent="#FF8C00">
      <ListSlideDecor emojis={['🎬', '🎥', '🍿', '📹', '✨', '🎞️']} />
      <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column', padding: '28px 20px 80px' }}>
        <div className="fs-sans a-fade-up" style={{ textAlign: 'center', fontSize: 13, color: '#FF8C00', letterSpacing: '0.18em', fontWeight: 800, textTransform: 'uppercase' }}>
          🎬 {t.vid_eyebrow}
        </div>
        <div className="fs-display a-fade-up" style={{
          textAlign: 'center', animationDelay: '0.15s',
          fontSize: 42, lineHeight: 1.04, letterSpacing: '-0.04em',
          fontWeight: 800, color: '#4A0E4E',
          marginTop: 8, marginBottom: 4,
          textShadow: '0 2px 0 rgba(255,255,255,0.65), 0 1px 3px rgba(74,14,78,0.12)',
        }}>
          <span style={{ fontStyle: 'italic', color: '#FF8C00' }}>{t.vid_title_a}</span>
          {t.vid_title_b ? ' ' + t.vid_title_b : ''}
        </div>
        <div className="fs-mono a-fade-up" style={{ textAlign: 'center', animationDelay: '0.22s', fontSize: 12, color: 'rgba(74,14,78,0.6)', marginBottom: 14, fontWeight: 600 }}>
          {t.vid_sub}
        </div>
        <div className="no-sb" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {list.map((v, i) => (
            <div key={v.url} dir="auto" className="a-slide-up-far" style={{
              padding: 10, background: '#fff', borderRadius: 22,
              border: '2px solid rgba(255,255,255,0.85)',
              boxShadow: '0 6px 0 rgba(209,112,0,0.22), 0 14px 24px -8px rgba(209,112,0,0.45)',
              flexShrink: 0,
              animationDelay: `${0.3 + i * 0.12}s`,
            }}>
              <video controls preload="metadata" playsInline src={v.url} style={{
                width: '100%', display: 'block', borderRadius: 14, background: '#000', maxHeight: 180,
              }} />
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '8px 4px 2px' }}>
                <div className="fs-display" style={{ fontSize: 16, fontWeight: 800, color: 'rgba(74,14,78,0.45)' }}>#{i + 1}</div>
                <div className="fs-sans" style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 800, color: '#4A0E4E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.author || '—'}</div>
                <div className="fs-mono" style={{ fontSize: 12, fontWeight: 700, color: '#FF8C00' }}>{fmtMB(v.size)}</div>
              </div>
            </div>
          ))}
          {showOverflow && (
            <button onClick={() => setExpanded(true)} className="press" style={{
              background: 'none', border: 'none', cursor: 'pointer',
              textAlign: 'center', fontSize: 11, color: '#FF8C00',
              fontWeight: 700, letterSpacing: '0.12em', padding: '6px 0', width: '100%',
            }}>
              {moreLabel} ↓
            </button>
          )}
        </div>
      </div>
    </SlideShell>
  );
})

export default SlideVideos;
