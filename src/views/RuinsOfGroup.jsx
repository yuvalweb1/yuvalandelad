// ============================================================
// RuinsOfGroup — top-level controller for The Ruins of [GroupName].
// Owns: kingdom (built once via buildKingdom), save state, and the
// title -> world -> case screen machine. Fog ink + Heart glow are
// handed back from RuinsCanvas only at case-entry time (onEnterCase);
// Heart glow itself is never stored — it's derived fresh from seals
// vs. kingdom.cases.length on every render via heartGlowPct().
// ============================================================
import { useState, useMemo, useEffect } from 'react';
import { interp } from '../i18n/index.js';
import { deriveChatName } from '../lib/history.js';
import { buildKingdom } from '../ruins/worldGen.js';
import { loadSave, recordSeal, addInk, heartGlowPct } from '../ruins/storage.js';
import RuinsCanvas from '../ruins/RuinsCanvas.jsx';
import CaseScene from '../ruins/CaseScene.jsx';

const BG = 'radial-gradient(circle at 50% 26%, rgba(244,199,123,0.10), transparent 55%), linear-gradient(180deg, #171327 0%, #120E20 55%, #0A0813 100%)';
const GOLD = '#F4C77B';

// Bespoke warm CTA — matches the in-game investigate / primary buttons
// so the whole mode shares one button identity (no generic cyan pop-btn).
function StepButton({ children, onClick }) {
  return (
    <button onClick={onClick} className="a-pop-in press" style={{
      minHeight: 54, padding: '0 30px', border: 'none', borderRadius: 999, cursor: 'pointer',
      background: 'linear-gradient(180deg, #FFE7B0, #F4B45A)', color: '#3A2A12',
      fontFamily: 'inherit', fontWeight: 800, fontSize: 17,
      boxShadow: '0 7px 0 #B57D32, 0 18px 32px -10px rgba(244,180,90,0.6)',
    }}>{children}</button>
  );
}

function Embers() {
  const spots = [
    { left: '18%', top: '24%', s: 8, d: '0s' }, { left: '76%', top: '30%', s: 6, d: '0.6s' },
    { left: '30%', top: '58%', s: 5, d: '1.2s' }, { left: '64%', top: '64%', s: 7, d: '0.3s' },
    { left: '48%', top: '42%', s: 5, d: '0.9s' }, { left: '84%', top: '52%', s: 6, d: '1.5s' },
  ];
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {spots.map((p, i) => (
        <span key={i} className="a-float" style={{
          position: 'absolute', left: p.left, top: p.top, width: p.s, height: p.s, borderRadius: '50%',
          background: 'radial-gradient(circle, #FFE7B0, rgba(244,180,90,0))', animationDelay: p.d,
        }} />
      ))}
    </div>
  );
}

function GameRoot({ children, onBack, t }) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: BG, overflow: 'hidden' }}>
      {children}
      <button onClick={onBack} className="press" aria-label={t.a11y_close || 'Close'} style={{
        position: 'absolute', top: 'calc(env(safe-area-inset-top, 0px) + 12px)', insetInlineEnd: 14, zIndex: 20,
        background: 'rgba(12,9,20,0.55)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        color: '#fff', border: '1px solid rgba(244,199,123,0.25)', width: 38, height: 38, borderRadius: '50%', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

function TitleScreen({ kingdom, t, chatName, onStart }) {
  const count = kingdom.cases.length;
  return (
    <div className="fs-sans" style={{
      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 18, padding: '32px 28px calc(env(safe-area-inset-bottom,0px) + 32px)', textAlign: 'center', color: '#FBFAF6',
    }}>
      <Embers />

      {/* Hero beacon */}
      <div className="a-pop-in" style={{ position: 'relative', marginBottom: 4 }}>
        <div aria-hidden style={{ position: 'absolute', inset: -28, borderRadius: '50%', background: 'radial-gradient(circle, rgba(244,199,123,0.4), transparent 70%)' }} className="a-pulse-glow" />
        <div style={{
          position: 'relative', width: 104, height: 104, borderRadius: '50%', fontSize: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'radial-gradient(circle at 38% 30%, #2C2440, #15111F)',
          border: '2px solid rgba(244,199,123,0.5)', boxShadow: '0 0 50px -6px rgba(244,199,123,0.5)',
        }}>🏛️</div>
      </div>

      <div className="fs-mono a-fade-up" style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.28em', textTransform: 'uppercase', color: GOLD, animationDelay: '0.05s' }}>
        {t.ruins_title_eyebrow || 'The Ruins of'}
      </div>
      <h1 className="fs-display a-fade-up" dir="auto" style={{ fontSize: 32, fontWeight: 800, margin: 0, letterSpacing: '-0.02em', lineHeight: 1.05, animationDelay: '0.1s' }}>
        {chatName}
      </h1>
      <p className="fs-serif a-fade-up" style={{ fontSize: 17.5, lineHeight: 1.55, color: 'rgba(251,250,246,0.82)', maxWidth: 330, margin: '2px 0 0', fontStyle: 'italic', animationDelay: '0.18s' }}>
        “{kingdom.openingLead}”
      </p>
      <div className="fs-mono a-fade-up" style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.06em', color: 'rgba(251,250,246,0.5)', animationDelay: '0.26s' }}>
        {interp(t.ruins_title_meta || '{n} ruins lost to the dark', { n: count })}
      </div>

      <div className="a-fade-up" style={{ marginTop: 12, animationDelay: '0.34s' }}>
        <StepButton onClick={onStart}>{t.ruins_start || 'Step inside'}</StepButton>
      </div>
    </div>
  );
}

function RuinsEmpty({ t, onBack }) {
  return (
    <div className="fs-sans" style={{
      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 14, padding: 28, textAlign: 'center', color: '#FBFAF6',
    }}>
      <Embers />
      <div aria-hidden style={{ fontSize: 60, filter: 'grayscale(0.3)', opacity: 0.9 }}>🏚️</div>
      <div className="fs-display" style={{ fontSize: 23, fontWeight: 800 }}>{t.ruins_empty_title || 'The ruins are quiet'}</div>
      <div style={{ fontSize: 14.5, lineHeight: 1.55, color: 'rgba(251,250,246,0.72)', maxWidth: 290 }}>{t.ruins_empty_body || "There isn't enough chaos here yet to build a kingdom. Try a livelier chat."}</div>
      <div style={{ marginTop: 8 }}><StepButton onClick={onBack}>{t.rm_back || 'Back'}</StepButton></div>
    </div>
  );
}

export default function RuinsOfGroup({ analytics, diagnostics, fileName, t, lang, isRTL = false, onBack }) {
  const kingdom = useMemo(() => buildKingdom(analytics, t, lang), [analytics, t, lang]);
  const [saveState, setSaveState] = useState(() => loadSave(analytics));
  const [screen, setScreen] = useState('title'); // 'title' | 'world' | 'case'
  const [activeCaseId, setActiveCaseId] = useState(null);
  const [playerPos, setPlayerPos] = useState(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const handler = (e) => setReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  if (!kingdom) {
    return (
      <GameRoot onBack={onBack} t={t}>
        <RuinsEmpty t={t} onBack={onBack} />
      </GameRoot>
    );
  }

  const { save, ck, sk } = saveState;
  const season = save.seasons[sk];
  const litCaseIds = Object.keys(season.seals);
  const glow = heartGlowPct(save, sk, kingdom.cases.length);
  const chatName = deriveChatName({ diagnostics, fileName });
  const activeCase = activeCaseId ? kingdom.cases.find(c => c.id === activeCaseId) : null;

  function handleEnterCase({ caseId, playerPos: pos, ink }) {
    const updated = addInk(analytics, ink);
    setSaveState({ save: updated, ck, sk });
    setPlayerPos(pos);
    setActiveCaseId(caseId);
    setScreen('case');
  }

  function handleCaseComplete({ caseId, grade }) {
    const updated = recordSeal(analytics, caseId, grade);
    setSaveState({ save: updated, ck, sk });
    setActiveCaseId(null);
    setScreen('world');
  }

  return (
    <GameRoot onBack={onBack} t={t}>
      {screen === 'title' && (
        <TitleScreen kingdom={kingdom} t={t} chatName={chatName} onStart={() => setScreen('world')} />
      )}
      {screen === 'world' && (
        <RuinsCanvas
          kingdom={kingdom}
          initialPlayerPos={playerPos || kingdom.spawn}
          initialInk={season.ink}
          litCaseIds={litCaseIds}
          heartGlowPct={glow}
          t={t} lang={lang} isRTL={isRTL} reducedMotion={reducedMotion}
          onEnterCase={handleEnterCase}
        />
      )}
      {screen === 'case' && activeCase && (
        <CaseScene caseData={activeCase} t={t} lang={lang} isRTL={isRTL} reducedMotion={reducedMotion} onComplete={handleCaseComplete} />
      )}
    </GameRoot>
  );
}
