import { useMemo, useRef, useEffect } from 'react';
import SlidesBlobBackground from '../components/SlidesBlobBackground.jsx';
import { adEnabled } from '../lib/ads.js';

export default function Wrapped({ analytics, diagnostics, selectedAuthor, setSelectedAuthor, slide, setSlide, profile, t, onExit, onMenu, slidesDef, slideComponents }) {
  const user = analytics.userMap[selectedAuthor];
  if (!user) return null;
  const userAchievements = analytics.achievementsByUser[selectedAuthor] || [];

  const slides = useMemo(() => slidesDef.filter(s => {
    // Group-first deck: skip a slide only when its verified data is missing.
    if (s === 'signature_words' && !analytics.users.some(x => x.topWord)) return false;
    if (s === 'group_top' && !((analytics.topWordsGroup && analytics.topWordsGroup.length) || (analytics.topEmojisGroup && analytics.topEmojisGroup.length))) return false;
    if (s === 'photos' && (!analytics.photos || analytics.photos.length === 0)) return false;
    if (s === 'drama_role' && !user) return false;
    if (s === 'ad' && !adEnabled('interstitial')) return false;
    return true;
  }), [selectedAuthor, userAchievements.length, user, analytics, profile]);

  const total = slides.length;
  const current = slides[slide];
  const SlideComp = slideComponents[current];

  const dirRef = useRef(1);

  useEffect(() => {
    if (slide >= total - 1) return;
    const id = setTimeout(() => {
      dirRef.current = 1;
      setSlide(s => Math.min(s + 1, total - 1));
    }, 6500);
    return () => clearTimeout(id);
  }, [slide, total, setSlide]);

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

      {/* Tap zones — pure touch convenience, hidden from assistive tech */}
      <div onClick={prev} aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '30%', zIndex: 4, touchAction: 'pan-y' }} />
      {slide < total - 1 && <div onClick={next} aria-hidden="true" style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '70%', zIndex: 4, touchAction: 'pan-y' }} />}

      {/* Slide with directional transition */}
      <div key={`${current}-${selectedAuthor}`}
        className={dirRef.current >= 0 ? 'slide-in-right' : 'slide-in-left'}
        style={{ flex: 1, position: 'relative', overflow: 'hidden', zIndex: 1 }}>
        {SlideComp && <SlideComp a={analytics} u={user} t={t} profile={profile} achievements={userAchievements} onExit={onExit} onMenu={onMenu} />}
      </div>
    </div>
  );
}
