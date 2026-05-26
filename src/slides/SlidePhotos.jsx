import React from 'react';
import SlideShell from './SlideShell.jsx';
import { interp, typedCopy } from '../i18n';

const SlidePhotos = React.memo(function SlidePhotos({ a, t, profile }) {
  const type = profile?.relationship || 'other';
  const photos = a.photos || [];
  if (photos.length === 0) return null;
  const shown = photos.slice(0, 9);
  const tilts = [-3, 2, -2, 3, -1, 2, -3, 1, -2];
  return (
    <SlideShell bg="#f3722c" accent="#FF8C00">
      <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', padding: '32px 22px 22px' }}>
        <div className="fs-sans a-fade-up" style={{ textAlign: 'center', fontSize: 12, color: '#FF8C00', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase' }}>
          {typedCopy(t, 'photos_eyebrow', type)}
        </div>
        <div className="fs-display a-fade-up" style={{ textAlign: 'center', animationDelay: '0.15s', fontSize: 30, lineHeight: 1.12, letterSpacing: '-0.03em', fontWeight: 800, color: '#2a0645', marginTop: 8, marginBottom: 4 }}>
          {interp(typedCopy(t, 'photos_title', type), { n: photos.length.toLocaleString() })}
        </div>
        <div className="fs-mono a-fade-up" style={{ textAlign: 'center', animationDelay: '0.2s', fontSize: 11, color: 'rgba(42,6,69,0.5)', marginBottom: 14 }}>
          {typedCopy(t, 'photos_sub', type)}
        </div>
        <div className="no-sb" style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {shown.map((p, i) => (
              <div key={p.url} className="a-spring" style={{
                aspectRatio: '1 / 1', borderRadius: 12, overflow: 'hidden',
                background: '#fff', padding: 3, transform: `rotate(${tilts[i % tilts.length]}deg)`,
                boxShadow: '0 6px 14px -4px rgba(74,14,78,0.4)', animationDelay: `${0.3 + i * 0.07}s`,
              }}>
                <img src={p.url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 9, display: 'block' }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </SlideShell>
  );
})

export default SlidePhotos;
