import { useMemo, useRef, useEffect, useState } from 'react';
import SlidesBlobBackground from '../components/SlidesBlobBackground.jsx';
import { adEnabled } from '../lib/ads.js';
import { slideHasData } from '../slides';

// Slides hosting playable audio/video — auto-advance pauses while the user
// listens, and the smart tap-to-advance is replaced with explicit chevron
// buttons so the audio/video controls own the slide area uncontested.
const MEDIA_SLIDES = new Set(['voice', 'videos']);

export default function Wrapped({ analytics, diagnostics, selectedAuthor, setSelectedAuthor, slide, setSlide, profile, t, onExit, onMenu, onRoastMode, slidesDef, slideComponents }) {
  const user = analytics.userMap[selectedAuthor];
  if (!user) return null;
  const userAchievements = analytics.achievementsByUser[selectedAuthor] || [];

  // Filter slides that lack data. slideHasData centralizes the rule so each
  // slide id has exactly one place where its "is there anything to show?"
  // check lives — including stickers/voice/videos (with-media exports only).
  const slides = useMemo(() => slidesDef.filter(s => {
    if (s === 'ad' && !adEnabled('interstitial')) return false;
    return slideHasData(s, analytics, user);
  }), [selectedAuthor, userAchievements.length, user, analytics, profile, slidesDef]);

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

  // Smart tap handler for non-media slides: clicks on interactive elements
  // (including native <audio>/<video> controls) pass through; bare-area clicks
  // advance the deck. Lives on the slide container, not an overlay, so the
  // slide's own scroll/touch behavior keeps working.
  const onSlideClick = (e) => {
    if (e.target.closest('button, a, input, textarea, label, audio, video, [role="button"]')) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < rect.width * 0.3) prev();
    else if (slide < total - 1) next();
  };

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

      {/* Media slides need explicit nav — the slide area belongs to audio/video. */}
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

      {/* Slide with directional transition. */}
      <div ref={slideContainerRef} key={`${current}-${selectedAuthor}`}
        onClick={isMediaSlide ? undefined : onSlideClick}
        className={dirRef.current >= 0 ? 'slide-in-right' : 'slide-in-left'}
        style={{ flex: 1, position: 'relative', overflow: 'hidden', zIndex: 1 }}>
        {SlideComp && <SlideComp a={analytics} u={user} t={t} profile={profile} achievements={userAchievements} onExit={onExit} onMenu={onMenu} onRoastMode={onRoastMode} />}
      </div>
    </div>
  );
}
