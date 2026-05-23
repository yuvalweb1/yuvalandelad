import { useState, useEffect } from 'react';

export default function Parsing({ fileName, parsingStage, diagnostics, t }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(x => x + 1), 80);
    return () => clearInterval(id);
  }, []);
  const fakeCount = diagnostics?.parsedMessages
    ? Math.min(diagnostics.parsedMessages, Math.floor(tick * 47))
    : Math.floor(tick * 23);

  const stages = [
    { label: t.parsing_label_open, detail: t.parsing_detail_open },
    { label: t.parsing_label_unzip, detail: t.parsing_detail_unzip },
    { label: t.parsing_label_read, detail: t.parsing_detail_read },
    { label: t.parsing_label_analyze, detail: t.parsing_detail_analyze },
    { label: t.parsing_label_build, detail: t.parsing_detail_build },
  ];

  return (
    <div style={{
      position: 'relative', height: '100%', overflow: 'hidden',
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      padding: '32px 28px',
      background: '#faf6f0',
    }}>
      {/* Background blobs matching landing page */}
      <div style={{
        position: 'absolute', top: -60, right: -70, width: 230, height: 230,
        borderRadius: '50%', background: '#ffd972', opacity: 0.55,
        filter: 'blur(72px)', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', top: 80, left: -80, width: 200, height: 200,
        borderRadius: '50%', background: '#f06449', opacity: 0.25,
        filter: 'blur(72px)', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: 60, right: -50, width: 200, height: 200,
        borderRadius: '50%', background: '#9cf6f6', opacity: 0.50,
        filter: 'blur(68px)', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: -40, left: -40, width: 180, height: 180,
        borderRadius: '50%', background: '#f1e4f3', opacity: 0.70,
        filter: 'blur(60px)', pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', zIndex: 10 }}>
        <div className="fs-mono a-fade-up" style={{
          fontSize: 11, color: '#f06449', letterSpacing: '0.22em',
          fontWeight: 700, textTransform: 'uppercase',
        }}>
          ✦ {t.parsing_msg_parsed}
        </div>
        <div className="fs-mono a-fade-in" style={{
          fontSize: 13, color: '#573280', marginTop: 6, wordBreak: 'break-all',
          opacity: 0.7, animationDelay: '0.2s',
        }}>
          {fileName}
        </div>
      </div>

      <div style={{ position: 'relative', zIndex: 10, textAlign: 'center' }}>
        <div className="fs-display a-spring" style={{
          fontSize: 96, lineHeight: 1, letterSpacing: '-0.05em', color: '#573280',
        }}>
          {fakeCount.toLocaleString()}
        </div>
        <div className="fs-mono" style={{
          fontSize: 13, color: '#573280', marginTop: 8, letterSpacing: '0.15em',
          opacity: 0.6, fontWeight: 700, textTransform: 'uppercase',
        }}>
          {t.parsing_msg_parsed}
        </div>
      </div>

      <div style={{ position: 'relative', zIndex: 10 }}>
        {stages.map((s, i) => {
          const active = i === parsingStage;
          const done = i < parsingStage;
          return (
            <div key={i} className="a-fade-up" style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '8px 0', opacity: done || active ? 1 : 0.3,
              animationDelay: `${i * 0.1}s`,
            }}>
              <div style={{
                width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                background: done ? '#f06449' : 'transparent',
                border: done ? 'none' : `2px solid ${active ? '#f06449' : 'rgba(87,50,128,0.25)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative',
              }}>
                {done && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff"
                    strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
                {active && (
                  <div className="a-spin" style={{
                    position: 'absolute', inset: -2,
                    border: '2px solid transparent', borderTopColor: '#f06449',
                    borderRadius: '50%',
                  }} />
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: active ? 700 : 500, color: done || active ? '#2a0645' : '#573280' }}>
                  {s.label}
                </div>
                {active && (
                  <div className="fs-mono a-fade-in" style={{
                    fontSize: 11, color: '#f06449', marginTop: 2,
                    letterSpacing: '0.08em', fontWeight: 700,
                  }}>
                    {s.detail}…
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
