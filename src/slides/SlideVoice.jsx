import React, { useState, useRef } from 'react';
import SlideShell from './SlideShell.jsx';
import ListSlideDecor from '../components/ListSlideDecor.jsx';

const MAX_ROWS = 3;

const SPEEDS = [1, 1.5, 2];

function fmtDuration(secs) {
  if (!secs || !isFinite(secs)) return null;
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `0:${String(s).padStart(2, '0')}`;
}

function VoiceRow({ v, index }) {
  const [playing, setPlaying] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(null);
  const audioRef = useRef(null);

  const onTimeUpdate = () => {
    const el = audioRef.current;
    if (!el || !el.duration) return;
    setProgress(el.currentTime / el.duration);
  };

  const seekTo = (e) => {
    e.stopPropagation();
    const el = audioRef.current;
    if (!el || !el.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    el.currentTime = ((e.clientX - rect.left) / rect.width) * el.duration;
  };

  const toggle = (e) => {
    e.stopPropagation();
    const el = audioRef.current;
    if (!el) return;
    if (playing) { el.pause(); } else { el.play(); }
  };

  const cycleSpeed = (e) => {
    e.stopPropagation();
    const next = (speedIdx + 1) % SPEEDS.length;
    setSpeedIdx(next);
    if (audioRef.current) audioRef.current.playbackRate = SPEEDS[next];
  };

  const btnStyle = {
    flexShrink: 0, height: 36, borderRadius: 10,
    background: '#00BFFF', border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 3px 0 #0089C4', color: '#fff',
  };

  return (
    <div dir="auto" className="a-slide-up-far" style={{
      padding: '12px 14px', background: '#fff', borderRadius: 20,
      border: '2px solid rgba(255,255,255,0.85)',
      boxShadow: '0 6px 0 rgba(0,137,196,0.22), 0 14px 24px -8px rgba(0,137,196,0.45)',
      flexShrink: 0,
      animationDelay: `${0.3 + index * 0.1}s`,
    }}>
      <audio
        ref={audioRef}
        src={v.url}
        preload="metadata"
        onLoadedMetadata={() => audioRef.current && setDuration(audioRef.current.duration)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setProgress(0); }}
        onTimeUpdate={onTimeUpdate}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div className="fs-display" style={{ width: 26, flexShrink: 0, fontSize: 17, fontWeight: 800, color: 'rgba(74,14,78,0.45)' }}>{index + 1}</div>
        <div className="fs-sans" style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 800, color: '#4A0E4E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.author || '—'}</div>
        {fmtDuration(duration) && (
          <div className="fs-mono" style={{ flexShrink: 0, fontSize: 12, fontWeight: 700, color: '#00BFFF', background: 'rgba(0,191,255,0.10)', borderRadius: 8, padding: '2px 7px' }}>
            {fmtDuration(duration)}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Play / pause */}
        <button type="button" onClick={toggle} className="press" style={{ ...btnStyle, width: 36 }}>
          {playing ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
              <rect x="5" y="4" width="4" height="16" rx="1.5" />
              <rect x="15" y="4" width="4" height="16" rx="1.5" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
              <polygon points="6,4 20,12 6,20" />
            </svg>
          )}
        </button>
        {/* Speed */}
        <button type="button" onClick={cycleSpeed} className="press" style={{ ...btnStyle, width: 44, fontSize: 12, fontWeight: 800 }}>
          {SPEEDS[speedIdx]}x
        </button>
        {/* Seekable progress bar */}
        <div onClick={seekTo} style={{
          flex: 1, height: 18, display: 'flex', alignItems: 'center', cursor: 'pointer',
        }}>
          <div style={{ position: 'relative', width: '100%', height: 4, borderRadius: 999, background: 'rgba(0,137,196,0.18)' }}>
            <div style={{
              height: '100%', borderRadius: 999, background: '#00BFFF',
              width: `${progress * 100}%`,
              transition: playing ? 'none' : 'width 0.2s',
            }} />
            <div style={{
              position: 'absolute', top: '50%', left: `${progress * 100}%`,
              width: 12, height: 12, borderRadius: '50%',
              background: '#00BFFF', border: '2px solid #fff',
              transform: 'translate(-50%, -50%)',
              boxShadow: '0 1px 4px rgba(0,137,196,0.5)',
              transition: playing ? 'none' : 'left 0.2s',
            }} />
          </div>
        </div>
        {/* Download */}
        <a
          href={v.url}
          download
          onClick={e => e.stopPropagation()}
          className="press"
          style={{ ...btnStyle, width: 36, textDecoration: 'none' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 3v13M7 11l5 5 5-5" />
            <path d="M5 20h14" />
          </svg>
        </a>
      </div>
    </div>
  );
}

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
      <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column', padding: '28px 20px 24px' }}>
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
            <VoiceRow key={v.url} v={v} index={i} />
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
