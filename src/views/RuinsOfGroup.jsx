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

const BG = 'linear-gradient(180deg, #1B1813, #2a2118)';

function GameRoot({ children, onBack, t }) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: BG, overflow: 'hidden' }}>
      {children}
      <button onClick={onBack} className="press" aria-label={t.a11y_close || 'Close'} style={{
        position: 'absolute', top: 'calc(env(safe-area-inset-top, 0px) + 12px)', insetInlineEnd: 14, zIndex: 20,
        background: 'rgba(0,0,0,0.28)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        color: '#fff', border: 'none', width: 38, height: 38, borderRadius: '50%', cursor: 'pointer',
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
  return (
    <div className="fs-sans a-fade-up" style={{
      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 16, padding: '32px 24px', textAlign: 'center', color: '#FBFAF6',
      background: 'radial-gradient(circle at 50% 30%, rgba(249,199,79,0.18), transparent 60%)',
    }}>
      <div aria-hidden style={{ fontSize: 56 }}>🏛️</div>
      <h1 className="fs-display" style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>
        {interp(t.ruins_title || 'The Ruins of {group}', { group: chatName })}
      </h1>
      <p style={{ fontSize: 15, lineHeight: 1.6, opacity: 0.85, maxWidth: 320, margin: 0 }}>{kingdom.openingLead}</p>
      <button className="pop-btn a-pop-in press" style={{ minHeight: 44, marginTop: 8 }} onClick={onStart}>
        {t.ruins_start || 'Step inside'}
      </button>
    </div>
  );
}

function RuinsEmpty({ t, onBack }) {
  return (
    <div className="fs-sans" style={{
      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 12, padding: 24, textAlign: 'center', color: '#FBFAF6',
    }}>
      <div aria-hidden style={{ fontSize: 64 }}>🏚️</div>
      <div className="fs-display" style={{ fontSize: 22, fontWeight: 800 }}>{t.ruins_empty_title || 'The ruins are quiet'}</div>
      <div style={{ fontSize: 14, opacity: 0.8, maxWidth: 280 }}>{t.ruins_empty_body || "There isn't enough chaos here yet to build a kingdom. Try a livelier chat."}</div>
      <button onClick={onBack} className="pop-btn press" style={{ marginTop: 12, minHeight: 44 }}>{t.rm_back || 'Back'}</button>
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
