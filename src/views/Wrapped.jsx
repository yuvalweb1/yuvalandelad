import { useMemo, useRef, useEffect, useState } from 'react';
import SlidesBlobBackground from '../components/SlidesBlobBackground.jsx';
import { adEnabled } from '../lib/ads.js';

// Slides hosting playable audio/video — auto-advance pauses while the user
// listens, and the tap-zone overlays shrink so media controls stay tappable.
const MEDIA_SLIDES = new Set(['voice', 'videos']);

export default function Wrapped({ analytics, diagnostics, selectedAuthor, setSelectedAuthor, slide, setSlide, profile, t, onExit, onMenu, onRoastMode, slidesDef, slideComponents }) {
  const user = analytics.userMap[selectedAuthor];
  if (!user) return null;
  const userAchievements = analytics.achievementsByUser[selectedAuthor] || [];

  const slides = useMemo(() => slidesDef.filter(s => {
    // Group-first deck: skip a slide only when its verified data is missing.
    if (s === 'signature_words' && !analytics.users.some(x => x.topWord)) return false;
    if (s === 'group_top' && !((analytics.topWordsGroup && analytics.topWordsGroup.length) || (analytics.topEmojisGroup && analytics.topEmojisGroup.length))) return false;
    if (s === 'photos' && (!analytics.photos || analytics.photos.length === 0)) return false;
    if (s === 'stickers' && (!analytics.stickers || analytics.stickers.length === 0)) return false;
    if (s === 'voice' && (!analytics.voice || analytics.voice.length === 0)) return false;
    if (s === 'videos' && (!analytics.videos || analytics.videos.length === 0)) return false;
    if (s === 'drama_role' && !user) return false;
    if (s === 'ad' && !adEnabled('interstitial')) return false;
    return true;
  }), [selectedAuthor, userAchievements.length, user, analytics, profile]);

  const total = slides.length;
  const current = slides[slide];
  const SlideComp = slideComponents[current];
  const isMediaSlide = MEDIA_SLIDES.has(current);

  const dirRef = useRef(1);
  const slideContainerRef = useRef(null);
  const [mediaPlaying, setMediaPlaying] = useState(false);

  // Reset playback flag on every slide change — a fresh slide can't already be
  // mid-playback. Without this the flag would stick if a slide unmounts while
  // its audio was "playing".
  useEffect(() => { setMediaPlaying(false); }, [current, selectedAuthor]);

  // Watch the slide subtree for any <audio>/<video> play/pause/ended events.
  // Capture phase because media events do not bubble. We re-query on each
  // pause/ended to see if ANY player is still active.
  useEffect(() => {
    const el = slideContainerRef.current;
    if (!el) return;
    const recompute = () => {
      const meds = el.querySelectorAll('audio, video');
      const anyPlaying = Array.from(meds).some(m => !m.paused && !m.ended);
      setMediaPlaying(anyPlaying);
    };
    const onPlay = () => setMediaPlaying(true);
    el.addEventListener('play', onPlay, true);
    el.addEventListener('pause', recompute, true);
    el.addEventListener('ended', recompute, true);
    return () => {
      el.removeEventListener('play', onPlay, true);
      el.removeEventListener('pause', recompute, true);
      el.removeEventListener('ended', recompute, true);
    };
  }, [current, selectedAuthor]);

  useEffect(() => {
    if (slide >= total - 1) return;
    if (mediaPlaying) return; // don't yank the user away mid-listen
    const id = setTimeout(() => {
      dirRef.current = 1;
      setSlide(s => Math.min(s + 1, total - 1));
    }, 6500);
    return () => clearTimeout(id);
  }, [slide, total, setSlide, mediaPlaying]);

  const next = () => { dirRef.current = 1;  setSlide(Math.min(slide + 1, total - 1)); };
  const prev = () => { dirRef.current = -1; setSlide(Math.max(slide - 1, 0)); };

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: '#fff5f7' }}>
      <SlidesBlobBackground />
      {/* Close */}
      <button onClick={onExit} className="press" aria-label={t.a11y_close || 'Close'} style={{
        position: 'absolute', top: 16, right: 16, zIndex: 5,
        background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(12px)',
        color: '#fff', border: 'none', width: 40, height: 40,
        borderRadius: '50%', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>

      {/* Tap zones — pure touch convenience, hidden from assistive tech.
          On media slides we drop the overlays entirely (they used to steal
          clicks from the audio/video play buttons). Nav still works via the
          explicit chevron buttons below + post-playback auto-advance. */}
      {!isMediaSlide && (
        <>
          <div onClick={prev} aria-hidden="true" style={{
            position: 'absolute', left: 0, top: 0, bottom: 0,
            width: '30%', zIndex: 4, touchAction: 'pan-y',
          }} />
          {slide < total - 1 && <div onClick={next} aria-hidden="true" style={{
            position: 'absolute', right: 0, top: 0, bottom: 0,
            width: '70%', zIndex: 4, touchAction: 'pan-y',
          }} />}
        </>
      )}

      {/* Media slides need explicit nav since the tap overlays are gone. */}
      {isMediaSlide && slide > 0 && (
        <button onClick={prev} className="press" aria-label="Previous" style={{
          position: 'absolute', bottom: 18, insetInlineStart: 18, zIndex: 5,
          width: 44, height: 44, borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(12px)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 6px 18px rgba(0,0,0,0.25)',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      )}
      {isMediaSlide && slide < total - 1 && (
        <button onClick={next} className="press" aria-label="Next" style={{
          position: 'absolute', bottom: 18, insetInlineEnd: 18, zIndex: 5,
          width: 44, height: 44, borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(12px)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 6px 18px rgba(0,0,0,0.25)',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      )}

      {/* Slide with directional transition */}
      <div ref={slideContainerRef} key={`${current}-${selectedAuthor}`}
        className={dirRef.current >= 0 ? 'slide-in-right' : 'slide-in-left'}
        style={{ flex: 1, position: 'relative', overflow: 'hidden', zIndex: 1 }}>
        {SlideComp && <SlideComp a={analytics} u={user} t={t} profile={profile} achievements={userAchievements} onExit={onExit} onMenu={onMenu} onRoastMode={onRoastMode} />}
      </div>
    </div>
  );
}
