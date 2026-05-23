import { useState } from 'react';

function MiniPhone({ children }) {
  return (
    <div style={{
      width: 128, height: 200, borderRadius: 18, background: '#ECE5DD',
      border: '5px solid #15151d', overflow: 'hidden', flexShrink: 0,
      position: 'relative', boxShadow: '0 10px 22px -8px rgba(74,14,78,0.45)',
    }}>{children}</div>
  );
}

function HandPointer({ style }) {
  return <div className="a-float" style={{ position: 'absolute', fontSize: 22, filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.35))', pointerEvents: 'none', ...style }}>👆</div>;
}

const HL = { background: '#FFD700', color: '#15151d', borderRadius: 4, boxShadow: '0 0 0 2px #FF69B4' };

function WaHeader({ name, highlightName, highlightDots }) {
  return (
    <div style={{ height: 30, background: '#075E54', display: 'flex', alignItems: 'center', gap: 5, padding: '0 7px', color: '#fff' }}>
      <span style={{ fontSize: 12 }}>‹</span>
      <div style={{ width: 17, height: 17, borderRadius: '50%', background: '#25D366', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 8.5, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: highlightName ? '1px 3px' : 0, ...(highlightName ? HL : {}) }}>{name}</div>
        <div style={{ fontSize: 6.5, opacity: 0.85 }}>online</div>
      </div>
      <span style={{ fontSize: 14, lineHeight: 1, padding: highlightDots ? '0 2px' : 0, ...(highlightDots ? HL : {}) }}>⋮</span>
    </div>
  );
}

function WaMock({ kind, t }) {
  const bubble = (txt, mine) => (
    <div style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '80%', background: mine ? '#DCF8C6' : '#fff', borderRadius: 8, padding: '4px 6px', fontSize: 7.5, color: '#222', boxShadow: '0 1px 1px rgba(0,0,0,0.12)' }} dir="auto">{txt}</div>
  );
  const chatBody = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: 8 }}>
      {bubble('היי מה קורה 😄', false)}{bubble('סבבה, ואצלך?', true)}{bubble('בואו ניפגש מחר 🔥', false)}
    </div>
  );
  if (kind === 'chat') return <MiniPhone><WaHeader name={t.howto_mock_group} />{chatBody}</MiniPhone>;
  if (kind === 'name') return <MiniPhone><WaHeader name={t.howto_mock_group} highlightName />{chatBody}<HandPointer style={{ top: 22, insetInlineStart: 38 }} /></MiniPhone>;
  if (kind === 'dots') return <MiniPhone><WaHeader name={t.howto_mock_group} highlightDots />{chatBody}<HandPointer style={{ top: 22, insetInlineEnd: 2 }} /></MiniPhone>;
  if (kind === 'export') {
    const rows = [
      { label: t.howto_mock_row_media, hl: false },
      { label: t.howto_mock_row_mute, hl: false },
      { label: t.howto_mock_export, hl: true },
      { label: t.howto_mock_row_clear, hl: false },
    ];
    return (
      <MiniPhone>
        <div style={{ height: 26, background: '#075E54' }} />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {rows.map((r, i) => (
            <div key={i} dir="auto" style={{ fontSize: 8.5, padding: '8px 8px', borderBottom: '1px solid #eee', color: r.hl ? '#15151d' : '#444', fontWeight: r.hl ? 800 : 500, ...(r.hl ? { background: '#FFD700', boxShadow: 'inset 0 0 0 2px #FF69B4' } : { background: '#fff' }) }}>{r.label}</div>
          ))}
        </div>
        <HandPointer style={{ top: 78, insetInlineEnd: 8 }} />
      </MiniPhone>
    );
  }
  if (kind === 'media') {
    return (
      <MiniPhone>
        <div style={{ height: '100%', background: 'rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 10 }}>
          <div style={{ background: '#fff', borderRadius: 10, width: '100%', padding: 8, boxShadow: '0 6px 18px rgba(0,0,0,0.3)' }}>
            <div dir="auto" style={{ fontSize: 8, color: '#666', marginBottom: 6 }}>{t.howto_mock_export}?</div>
            <div dir="auto" style={{ fontSize: 9, fontWeight: 800, color: '#15151d', padding: 7, borderRadius: 6, background: '#FFD700', boxShadow: '0 0 0 2px #FF69B4', textAlign: 'center', marginBottom: 5 }}>📸 {t.howto_mock_media}</div>
            <div dir="auto" style={{ fontSize: 9, fontWeight: 600, color: '#444', padding: 7, borderRadius: 6, background: '#f0f0f0', textAlign: 'center' }}>{t.howto_mock_nomedia}</div>
          </div>
        </div>
        <HandPointer style={{ top: 70, insetInlineStart: 26 }} />
      </MiniPhone>
    );
  }
  // upload
  return (
    <MiniPhone>
      <div style={{ height: '100%', background: 'linear-gradient(180deg,#FFF6D6,#FDE6F1)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 10 }}>
        <div style={{ fontSize: 42 }}>📤</div>
        <div dir="auto" style={{ fontSize: 9.5, fontWeight: 800, color: '#4A0E4E', textAlign: 'center', lineHeight: 1.3 }}>{t.howto_mock_upload}</div>
      </div>
    </MiniPhone>
  );
}

export default function HowToGuide({ t, onStart }) {
  const [platform, setPlatform] = useState('ios');
  const steps = platform === 'ios'
    ? [{ k: 'chat', b: t.howto_ios_1 }, { k: 'name', b: t.howto_ios_2 }, { k: 'export', b: t.howto_ios_3 }, { k: 'media', b: t.howto_ios_4 }, { k: 'upload', b: t.howto_ios_5 }]
    : [{ k: 'chat', b: t.howto_and_1 }, { k: 'dots', b: t.howto_and_2 }, { k: 'export', b: t.howto_and_3 }, { k: 'media', b: t.howto_and_4 }, { k: 'upload', b: t.howto_and_5 }];
  const Tab = ({ id, label }) => (
    <button onClick={() => setPlatform(id)} className="press" style={{
      flex: 1, padding: '10px', borderRadius: 14, border: 'none', cursor: 'pointer',
      fontSize: 15, fontWeight: 800,
      background: platform === id ? '#4A0E4E' : 'transparent',
      color: platform === id ? '#fff' : 'rgba(74,14,78,0.6)',
      transition: 'background 0.15s',
    }}>{label}</button>
  );
  return (
    <div className="no-sb" style={{ position: 'relative', height: '100%', overflowY: 'auto', background: 'linear-gradient(180deg,#FFF6D6 0%,#FFF0E2 46%,#FDE6F1 100%)' }}>
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: -70, right: -70, width: 220, height: 220, borderRadius: '50%', background: '#FFD700', opacity: 0.5, filter: 'blur(72px)' }} />
        <div style={{ position: 'absolute', bottom: -50, left: -60, width: 200, height: 200, borderRadius: '50%', background: '#FF69B4', opacity: 0.32, filter: 'blur(70px)' }} />
      </div>
      <div style={{ position: 'relative', zIndex: 1, padding: '22px 18px 22px', display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
        <div className="fs-mono a-fade-up" style={{ fontSize: 11, color: '#FF8C00', letterSpacing: '0.18em', fontWeight: 700, textTransform: 'uppercase' }}>✦ {t.howto_eyebrow}</div>
        <h1 className="fs-display a-fade-up" style={{ animationDelay: '0.08s', fontSize: 34, lineHeight: 1.04, letterSpacing: '-0.04em', fontWeight: 800, color: '#4A0E4E', margin: '8px 0 6px' }}>{t.howto_title}</h1>
        <p className="fs-sans a-fade-up" style={{ animationDelay: '0.14s', margin: 0, fontSize: 15, color: 'rgba(74,14,78,0.65)', fontWeight: 500 }}>{t.howto_sub}</p>

        {/* platform toggle */}
        <div className="a-fade-up" style={{ animationDelay: '0.2s', display: 'flex', gap: 4, marginTop: 16, padding: 4, background: 'rgba(74,14,78,0.07)', borderRadius: 16 }}>
          <Tab id="ios" label={`🍏 ${t.howto_ios}`} />
          <Tab id="android" label={`🤖 ${t.howto_android}`} />
        </div>

        {/* steps */}
        <div key={platform} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
          {steps.map((s, i) => (
            <div key={i} className="a-slide-up-far" style={{
              display: 'flex', gap: 12, alignItems: 'center',
              background: '#fff', borderRadius: 22, padding: 12,
              border: '2px solid rgba(255,255,255,0.8)',
              boxShadow: '0 7px 0 rgba(74,14,78,0.07), 0 16px 30px -12px rgba(74,14,78,0.3)',
              animationDelay: `${0.25 + i * 0.08}s`,
            }}>
              <WaMock kind={s.k} t={t} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ width: 30, height: 30, borderRadius: 999, background: '#FFD700', color: '#4A0E4E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16, boxShadow: '0 3px 0 #E0A800' }} className="fs-display">{i + 1}</div>
                <div className="fs-sans" dir="auto" style={{ marginTop: 8, fontSize: 16, lineHeight: 1.35, fontWeight: 700, color: '#4A0E4E' }}>{s.b}</div>
              </div>
            </div>
          ))}
        </div>

        {/* tip */}
        <div className="a-fade-up" dir="auto" style={{ marginTop: 14, padding: '12px 14px', background: 'rgba(0,191,255,0.12)', borderRadius: 16, fontSize: 13, lineHeight: 1.45, color: '#0A4A66', fontWeight: 600 }}>{t.howto_tip}</div>

        {/* CTA */}
        <button onClick={onStart} className="press a-gradient-shift" style={{
          marginTop: 18, width: '100%', position: 'relative', overflow: 'hidden',
          padding: '18px', color: '#4A0E4E',
          background: 'linear-gradient(135deg, #FFE45C 0%, #FFD700 50%, #FFB800 100%)',
          backgroundSize: '200% 200%', border: '2px solid rgba(255,255,255,0.7)', borderRadius: 22,
          fontSize: 19, fontWeight: 800, cursor: 'pointer',
          boxShadow: '0 8px 0 #E0A800, 0 18px 34px -6px rgba(224,168,0,0.6)',
        }}>
          <div className="a-shine" style={{ position: 'absolute', inset: 0 }} />
          <span className="fs-display" style={{ position: 'relative' }}>{t.howto_cta}</span>
        </button>
      </div>
    </div>
  );
}
