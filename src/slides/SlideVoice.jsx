import React, { useState } from 'react';
import SlideShell from './SlideShell.jsx';
import ListSlideDecor from '../components/ListSlideDecor.jsx';
import { interp } from '../i18n';

const BYTES_PER_SECOND = 2000;
const fmtDuration = (bytes) => {
  const s = Math.max(1, Math.round(bytes / BYTES_PER_SECOND));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60), r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
};

const MAX_ROWS = 4;

const SlideVoice = React.memo(function SlideVoice({ a, t }) {
  const allList = a.voice || [];
  if (allList.length === 0) return null;
  const [expanded, setExpanded] = useState(false);
  const overflow = allList.length - MAX_ROWS;
  const showOverflow = overflow > 0 && !expanded;
  const list = showOverflow ? allList.slice(0, MAX_ROWS) : allList;
  const moreLabel = (t.lb_more || '+{n} more').replace('{n}', overflow);
  return (
    <SlideShell bg="#577590" accent="#00BFFF">
      <ListSlideDecor emojis={['🎙️', '🔊', '🗣️', '🎧', '✨', '💬']} />
      <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column', padding: '28px 20px 80px' }}>
        <div className="fs-sans a-fade-up" style={{ textAlign: 'center', fontSize: 13, color: '#00BFFF', letterSpacing: '0.18em', fontWeight: 800, textTransform: 'uppercase' }}>
          🎙️ {t.voice_eyebrow}
        </div>
        <div className="fs-display a-fade-up" style={{
          textAlign: 'center', animationDelay: '0.15s',
          fontSize: 42, lineHeight: 1.04, letterSpacing: '-0.04em',
          fontWeight: 800, color: '#4A0E4E',
          marginTop: 8, marginBottom: 4,
          textShadow: '0 2px 0 rgba(255,255,255,0.65), 0 1px 3px rgba(74,14,78,0.12)',
        }}>
          <span style={{ fontStyle: 'italic', color: '#00BFFF' }}>{t.voice_title_a}</span>
          {t.voice_title_b ? ' ' + t.voice_title_b : ''}
        </div>
        <div className="fs-mono a-fade-up" style={{ textAlign: 'center', animationDelay: '0.22s', fontSize: 12, color: 'rgba(74,14,78,0.6)', marginBottom: 14, fontWeight: 600 }}>
          {t.voice_sub}
        </div>
        <div className="no-sb" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {list.map((v, i) => (
            <div key={v.url} dir="auto" className="a-slide-up-far" style={{
              padding: '12px 14px', background: '#fff', borderRadius: 20,
              border: '2px solid rgba(255,255,255,0.85)',
              boxShadow: '0 6px 0 rgba(0,137,196,0.22), 0 14px 24px -8px rgba(0,137,196,0.45)',
              animationDelay: `${0.3 + i * 0.1}s`,
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                <div className="fs-display" style={{ width: 26, fontSize: 17, fontWeight: 800, color: 'rgba(74,14,78,0.45)' }}>{i + 1}</div>
                <div className="fs-sans" style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 800, color: '#4A0E4E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.author || '—'}</div>
                <div className="fs-mono" style={{ fontSize: 14, fontWeight: 800, color: '#00BFFF' }}>{fmtDuration(v.size)}</div>
              </div>
              <audio controls preload="metadata" src={v.url} style={{ width: '100%', height: 40 }} />
            </div>
          ))}
          {showOverflow && (
            <button onClick={() => setExpanded(true)} className="press" style={{
              background: 'none', border: 'none', cursor: 'pointer',
              textAlign: 'center', fontSize: 11, color: '#00BFFF',
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

export default SlideVoice;
