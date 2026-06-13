// ============================================================
// THE LONG RUN — Duo mode as a progression mini-game.
// A side-scrolling runner whose levels are compiled from the
// pair's chat data (see docs/DUO_GAME_DESIGN.md). This file is
// the React shell: world map → run (RunCanvas) → overlays
// (capsule / boss bet / pause / death) → results → album.
// All persistent progression lives in src/duo/storage.js.
// ============================================================
import { useState, useMemo, useRef, useEffect } from 'react';
import { interp, RTL_LANGS } from '../i18n';
import RunCanvas from '../duo/RunCanvas.jsx';
import { buildLevel, LEVEL_COUNT } from '../duo/levelGen.js';
import { buildQuestions } from '../duo/questions.js';
import { buildArtifacts } from '../duo/artifacts.js';
import {
  loadSave, recordRun, totalStars, isUnlocked,
  STAR_GATES, DOUBLE_JUMP_AT,
} from '../duo/storage.js';

const GOLD = '#f9c74f';
const PLAYER_COLOR = '#ffd166';
const PARTNER_COLOR = '#7cc4ff';
const INK = '#0d1126';
const ZONE_EMOJI = ['🌄', '🌞', '🌆', '🌌'];

function Avatar({ name, color, size = 44 }) {
  return (
    <div className="fs-display" style={{
      width: size, height: size, borderRadius: '50%',
      background: `radial-gradient(circle at 30% 25%, ${color} 0%, ${color}bb 75%)`,
      color: INK, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.42, fontWeight: 800, flexShrink: 0,
      border: '2px solid rgba(255,255,255,0.25)',
      boxShadow: `0 6px 18px ${color}55`,
    }}>
      {(name || '?')[0].toUpperCase()}
    </div>
  );
}

function StarsRow({ n, size = 15, max = 3 }) {
  return (
    <div style={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} style={{ fontSize: size, filter: i < n ? `drop-shadow(0 0 5px ${GOLD})` : 'none', opacity: i < n ? 1 : 0.28 }}>
          {i < n ? '⭐' : '☆'}
        </span>
      ))}
    </div>
  );
}

// Bottom sheet shared by picker / album / trails.
function Sheet({ onClose, children }) {
  return (
    <div onClick={onClose} style={{
      position: 'absolute', inset: 0, zIndex: 80,
      background: 'rgba(6,7,12,0.66)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'flex-end', animation: 'dqFade 0.18s ease-out',
    }}>
      <div onClick={(e) => e.stopPropagation()} className="no-sb" style={{
        width: '100%', maxHeight: '78%', overflowY: 'auto',
        background: 'linear-gradient(180deg, #181b2c 0%, #0e0f18 100%)',
        borderRadius: '24px 24px 0 0', border: '1px solid rgba(255,255,255,0.10)',
        borderBottom: 'none', padding: '16px 16px calc(env(safe-area-inset-bottom, 0px) + 22px)',
        boxShadow: '0 -20px 50px rgba(0,0,0,0.6)',
        animation: 'dqSheetUp 0.26s cubic-bezier(0.16,1,0.3,1)',
      }}>
        <div style={{ width: 38, height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.22)', margin: '0 auto 12px' }} />
        {children}
      </div>
    </div>
  );
}

// Centered modal used by intro / capsule / boss / death overlays.
function Modal({ children }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 70,
      background: 'rgba(6,7,12,0.72)', backdropFilter: 'blur(5px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, animation: 'dqFade 0.2s ease-out',
    }}>
      <div style={{
        width: '100%', maxWidth: 340,
        background: 'linear-gradient(170deg, #1c2038 0%, #11131f 100%)',
        border: '1px solid rgba(255,255,255,0.12)', borderRadius: 24,
        padding: '22px 20px', boxShadow: '0 28px 60px -16px rgba(0,0,0,0.8)',
        animation: 'dqPop 0.34s cubic-bezier(0.34,1.56,0.64,1) both',
        maxHeight: '86%', overflowY: 'auto',
      }} className="no-sb">
        {children}
      </div>
    </div>
  );
}

function BigButton({ onClick, children, ghost, style }) {
  return (
    <button onClick={onClick} className="press" style={{
      width: '100%', padding: '15px', borderRadius: 16, cursor: 'pointer',
      background: ghost ? 'rgba(255,255,255,0.08)' : `linear-gradient(135deg, ${GOLD} 0%, #FF8C00 100%)`,
      color: ghost ? '#fff' : INK,
      border: ghost ? '1px solid rgba(255,255,255,0.16)' : 'none',
      fontFamily: 'var(--font-display, inherit)', fontWeight: 800, fontSize: 16,
      boxShadow: ghost ? 'none' : '0 6px 0 rgba(0,0,0,0.3), 0 14px 26px -8px rgba(249,199,79,0.5)',
      ...style,
    }}>
      {children}
    </button>
  );
}

// Artifact card body — renders the recovered moment by type.
function ArtifactBody({ art, t, A, B }) {
  const d = art.data || {};
  const line = (key, vars) => interp(t[key] || '', vars);
  switch (art.type) {
    case 'transcript':
      return (
        <div>
          <div className="fs-mono" style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
            {line('duoq_art_transcript_meta', { date: d.date, n: d.count })}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(d.excerpts || []).map((e, i) => (
              <div key={i} dir="auto" style={{
                alignSelf: e.author === A ? 'flex-end' : 'flex-start',
                maxWidth: '88%', padding: '7px 11px', borderRadius: 13,
                background: e.author === A ? `${PLAYER_COLOR}2b` : `${PARTNER_COLOR}26`,
                border: `1px solid ${e.author === A ? PLAYER_COLOR : PARTNER_COLOR}44`,
                fontSize: 13, lineHeight: 1.4, color: 'rgba(255,255,255,0.92)',
              }}>
                <div className="fs-mono" style={{ fontSize: 9, fontWeight: 800, color: e.author === A ? PLAYER_COLOR : PARTNER_COLOR, marginBottom: 2 }}>
                  {e.author}
                </div>
                {e.isVoice ? '🎤 …' : e.hasMedia ? '📷 …' : e.content}
              </div>
            ))}
          </div>
        </div>
      );
    case 'origin':
      return <p style={bodyStyle}>{line('duoq_art_origin_body', { date: d.date, days: d.days, total: (d.total || 0).toLocaleString() })}</p>;
    case 'silence':
      return <p style={bodyStyle}>{line('duoq_art_silence_body', { days: d.days >= 1 ? d.days : 1, from: d.from })}</p>;
    case 'record':
      return <p style={bodyStyle}>{line('duoq_art_record_body', { date: d.date, n: (d.count || 0).toLocaleString() })}</p>;
    case 'bond':
      return <p style={bodyStyle}>{line('duoq_art_bond_body', { pct: d.pct, n: (d.count || 0).toLocaleString() })}</p>;
    case 'streak':
      return <p style={bodyStyle}>{line('duoq_art_streak_body', { who: d.who, days: d.days })}</p>;
    case 'nightcap':
      return <p style={bodyStyle}>{line('duoq_art_nightcap_body', { n: d.count })}</p>;
    default:
      return null;
  }
}
const bodyStyle = { fontSize: 14, lineHeight: 1.55, color: 'rgba(255,255,255,0.85)', margin: 0 };

export default function DuoQuest({ analytics, selectedAuthor, t, lang, onBack }) {
  const users = analytics.users || [];
  const isRTL = RTL_LANGS.has(lang);

  // Seed the pair: tightest duo, with the viewer pulled in when known.
  const [initA, initB] = useMemo(() => {
    const names = users.map((u) => u.author);
    let a = names[0], b = names[1];
    if (analytics.topDuo?.names?.length === 2) [a, b] = analytics.topDuo.names;
    if (selectedAuthor && names.includes(selectedAuthor)) {
      if (a !== selectedAuthor && b !== selectedAuthor) b = a, a = selectedAuthor;
      else if (b === selectedAuthor) { b = a; a = selectedAuthor; }
    }
    return [a, b];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [A, setA] = useState(initA);            // the player
  const [B, setB] = useState(initB);            // the companion
  const [screen, setScreen] = useState('map');  // map | run | results
  const [overlay, setOverlay] = useState(null); // intro | capsule | boss | paused | dead | picker | album | trails
  const [levelIdx, setLevelIdx] = useState(0);
  const [runId, setRunId] = useState(0);
  const [runStats, setRunStats] = useState(null);
  const [bossPick, setBossPick] = useState(null);
  const [bossDone, setBossDone] = useState(null); // null | true | false (correct?)
  const [saveState, setSaveState] = useState(() => loadSave(analytics, initA, initB));
  const reducedMotion = useMemo(
    () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches, []);

  const { save, sk } = saveState;
  const stars = totalStars(save, sk);
  const season = save.seasons[sk] || { stars: {}, boss: {}, runs: 0 };
  const hasDoubleJump = stars >= DOUBLE_JUMP_AT;

  const questions = useMemo(() => buildQuestions(analytics, A, B), [analytics, A, B]);
  const artifacts = useMemo(() => buildArtifacts(analytics, A, B), [analytics, A, B]);
  const level = useMemo(() => buildLevel(analytics, A, B, levelIdx), [analytics, A, B, levelIdx]);
  const question = questions.length ? questions[levelIdx % questions.length] : null;

  const mapRef = useRef(null);

  function refreshSave(a = A, b = B) { setSaveState(loadSave(analytics, a, b)); }

  function pickPair(name, slot) {
    let na = A, nb = B;
    if (slot === 'A') na = name; else nb = name;
    if (na === nb) return;
    setA(na); setB(nb);
    setOverlay(null); setScreen('map');
    setSaveState(loadSave(analytics, na, nb));
  }

  function startRun(idx) {
    setLevelIdx(idx);
    setRunStats(null); setBossPick(null); setBossDone(null);
    setRunId(r => r + 1);
    setOverlay(null);
    setScreen('run');
  }

  function handleFinish(stats) {
    setRunStats(stats);
    if (question) { setBossPick(null); setBossDone(null); setOverlay('boss'); }
    else completeRun(stats, null);
  }

  function completeRun(stats, bossCorrect) {
    const starCount = 1 + (stats.capsule ? 1 : 0) + (bossCorrect ? 1 : 0);
    const updated = recordRun(analytics, A, B, levelIdx, {
      stars: starCount,
      coins: stats.coins,
      bossCorrect,
      artifactId: stats.capsule ? artifacts[levelIdx].id : null,
    });
    setSaveState({ save: updated, pk: saveState.pk, sk });
    setRunStats({ ...stats, stars: starCount, bossCorrect });
    setOverlay(null);
    setScreen('results');
  }

  function answerBoss(side) {
    if (bossPick) return;
    setBossPick(side);
    setBossDone(side === question.answer);
  }

  // ── Share card: drawn on an offscreen canvas (no DOM capture) ──
  async function shareRun() {
    const c = document.createElement('canvas');
    c.width = 1080; c.height = 1350;
    const ctx = c.getContext('2d');
    const pal = level.palette;
    const sky = ctx.createLinearGradient(0, 0, 0, 1350);
    sky.addColorStop(0, pal.skyTop); sky.addColorStop(1, pal.skyBot);
    ctx.fillStyle = sky; ctx.fillRect(0, 0, 1080, 1350);
    ctx.textAlign = 'center';
    ctx.fillStyle = GOLD; ctx.font = '800 44px sans-serif';
    ctx.fillText((t.duoq_title || 'THE LONG RUN').toUpperCase(), 540, 130);
    ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.font = '600 34px sans-serif';
    ctx.fillText(levelName(levelIdx), 540, 195);
    // Avatars
    const drawAv = (x, color, name) => {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(x, 360, 95, 0, 7); ctx.fill();
      ctx.fillStyle = INK; ctx.font = '800 88px sans-serif';
      ctx.fillText((name || '?')[0].toUpperCase(), x, 392);
      ctx.fillStyle = '#fff'; ctx.font = '700 36px sans-serif';
      ctx.fillText(name, x, 520);
    };
    drawAv(350, PLAYER_COLOR, A);
    drawAv(730, PARTNER_COLOR, B);
    ctx.font = '64px serif'; ctx.fillText('🤝', 540, 385);
    // Stars
    ctx.font = '110px serif';
    const s = runStats?.stars || 0;
    ctx.fillText('⭐'.repeat(s) + '☆'.repeat(3 - s), 540, 700);
    // Stats line
    ctx.fillStyle = '#fff'; ctx.font = '700 40px sans-serif';
    ctx.fillText(
      `${runStats?.coins ?? 0} ${t.duoq_share_coins || 'memories'} · ×${runStats?.comboBest ?? 0} ${t.duoq_combo || 'COMBO'}`,
      540, 800);
    // Insight
    if (runStats?.bossCorrect != null && question) {
      const txt = interp(t[`duoq_q_${question.id}_win`] || '', bossVars());
      ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.font = '500 34px sans-serif';
      wrapText(ctx, txt, 540, 900, 880, 48);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.font = '600 30px sans-serif';
    ctx.fillText(t.duoq_share_footer || 'Recapped · The Long Run', 540, 1270);

    const blob = await new Promise(res => c.toBlob(res, 'image/png'));
    if (!blob) return;
    const file = new File([blob], 'the-long-run.png', { type: 'image/png' });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] });
        return;
      }
    } catch { /* fall through to download */ }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'the-long-run.png'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function wrapText(ctx, text, x, y, maxW, lh) {
    const words = (text || '').split(' ');
    let line = '', yy = y;
    for (const w of words) {
      const probe = line ? line + ' ' + w : w;
      if (ctx.measureText(probe).width > maxW && line) {
        ctx.fillText(line, x, yy); line = w; yy += lh;
      } else line = probe;
    }
    if (line) ctx.fillText(line, x, yy);
  }

  function levelName(idx) {
    const zone = Math.min(3, Math.floor(idx / 2));
    const zoneName = t[`duoq_zone_${zone}`] || ['Daybreak', 'High Noon', 'Golden Hour', 'Midnight'][zone];
    return `${zoneName} ${Math.floor(idx / 2) + 1}-${(idx % 2) + 1}`;
  }

  function bossVars() {
    if (!question) return {};
    const w = question.answer === 'A' ? A : B;
    const l = question.answer === 'A' ? B : A;
    const wv = question.fmt(question.answer === 'A' ? question.valA : question.valB);
    const lv = question.fmt(question.answer === 'A' ? question.valB : question.valA);
    return { w, l, wv, lv, a: A, b: B };
  }

  // Suggested next node: first unlocked level without stars.
  const nextIdx = useMemo(() => {
    for (let i = 0; i < LEVEL_COUNT; i++) {
      if (isUnlocked(save, sk, i) && !(season.stars[i] > 0)) return i;
    }
    return -1;
  }, [save, sk, season]);

  // Album: unique artifacts + found state.
  const albumItems = useMemo(() => {
    const seen = new Set(); const out = [];
    for (const a of artifacts) {
      if (seen.has(a.id)) continue;
      seen.add(a.id);
      out.push({ ...a, found: !!save.artifacts[a.id] });
    }
    return out;
  }, [artifacts, save]);
  const foundCount = albumItems.filter(a => a.found).length;

  const bg = 'radial-gradient(ellipse at 50% -8%, #232744 0%, #0c0d15 64%)';

  // ── Tiny chats can't run ────────────────────────────────────
  if (users.length < 2) {
    return (
      <div style={{ height: '100%', background: bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 52 }}>🏃</div>
        <div className="fs-sans" style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>{t.duoq_need_two || 'The Long Run needs two people in the chat.'}</div>
        <BigButton onClick={onBack} ghost style={{ maxWidth: 200 }}>{t.rm_back || 'Back'}</BigButton>
      </div>
    );
  }

  return (
    <div className="no-sb" style={{ height: '100%', position: 'relative', background: bg, overflow: 'hidden' }}>
      <style>{`
        @keyframes dqFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes dqSheetUp { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes dqPop { 0% { transform: scale(0.82) translateY(16px); opacity: 0; } 100% { transform: scale(1) translateY(0); opacity: 1; } }
        @keyframes dqStar { 0% { transform: scale(0) rotate(-30deg); opacity: 0; } 60% { transform: scale(1.35) rotate(8deg); opacity: 1; } 100% { transform: scale(1) rotate(0); opacity: 1; } }
        @keyframes dqNodePulse { 0%,100% { box-shadow: 0 0 0 0 rgba(249,199,79,0.5); } 50% { box-shadow: 0 0 0 12px rgba(249,199,79,0); } }
        @keyframes dqBarRace { from { width: 8%; } }
        @keyframes dqEnvelope { 0% { transform: scale(0.4) rotate(-10deg); } 55% { transform: scale(1.15) rotate(4deg); } 100% { transform: scale(1) rotate(0); } }
        @keyframes dqRise { from { opacity: 0; transform: translateY(26px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* ════════ MAP ════════ */}
      {screen === 'map' && (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          {/* Header */}
          <div style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 16px 10px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={onBack} className="press" style={hdrBtn}>{t.rm_back || 'Back'}</button>
            <div style={{ flex: 1 }} />
            <div className="fs-mono" style={{ fontSize: 12, fontWeight: 800, color: GOLD, background: 'rgba(249,199,79,0.12)', border: `1px solid ${GOLD}44`, borderRadius: 999, padding: '6px 12px' }}>
              ⭐ {stars}/{LEVEL_COUNT * 3}
            </div>
            <button onClick={() => setOverlay('album')} className="press" style={{ ...hdrBtn, position: 'relative' }}>
              💌 {foundCount}/{albumItems.length}
            </button>
          </div>

          {/* Title + pair */}
          <div style={{ textAlign: 'center', padding: '2px 16px 10px' }}>
            <div className="fs-display" style={{ fontSize: 27, fontWeight: 800, color: '#fff', letterSpacing: '-0.03em' }}>
              {t.duoq_title || 'THE LONG RUN'}
            </div>
            <div className="fs-sans" style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
              {t.duoq_subtitle || 'Your year together, level by level.'}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 10 }}>
              <button onClick={() => users.length > 2 && setOverlay('picker')} className="press" style={pairChip}>
                <Avatar name={A} color={PLAYER_COLOR} size={26} />
                <span dir="auto" style={pairName}>{A}</span>
              </button>
              <span style={{ fontSize: 14 }}>🤝</span>
              <button onClick={() => users.length > 2 && setOverlay('picker')} className="press" style={pairChip}>
                <Avatar name={B} color={PARTNER_COLOR} size={26} />
                <span dir="auto" style={pairName}>{B}</span>
              </button>
            </div>
            {hasDoubleJump && (
              <div className="fs-mono" style={{ marginTop: 8, fontSize: 10, color: PARTNER_COLOR, letterSpacing: '0.08em' }}>
                🪽 {t.duoq_double_jump_on || 'DOUBLE JUMP UNLOCKED — tap twice mid-air'}
              </div>
            )}
          </div>

          {/* The path (bottom = level 1, climb upward) */}
          <div ref={mapRef} className="no-sb" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column-reverse', padding: '10px 0 64px' }}>
            <div style={{ display: 'flex', flexDirection: 'column-reverse', alignItems: 'center' }}>
              {Array.from({ length: LEVEL_COUNT }, (_, i) => {
                const unlocked = isUnlocked(save, sk, i);
                const sc = season.stars[i] || 0;
                const zone = Math.min(3, Math.floor(i / 2));
                const gateBlocked = unlocked === false && i > 0 && (season.stars[i - 1] || 0) > 0 && stars < (STAR_GATES[i] || 0);
                const isNext = i === nextIdx;
                const side = i % 2 === 0 ? -56 : 56;
                return (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    {/* connector */}
                    {i > 0 && (
                      <div style={{
                        width: 3, height: 30, borderRadius: 2, margin: '2px 0',
                        background: unlocked ? `linear-gradient(180deg, ${GOLD}, ${GOLD}33)` : 'rgba(255,255,255,0.10)',
                        transform: `translateX(${side / 2}px) rotate(${i % 2 === 0 ? 18 : -18}deg)`,
                      }} />
                    )}
                    <div style={{ transform: `translateX(${side}px)`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <button
                        aria-label={`${t.duoq_level || 'Level'} ${i + 1}`}
                        onClick={() => unlocked && (setLevelIdx(i), setOverlay('intro'))}
                        className={unlocked ? 'press' : ''}
                        style={{
                          width: 68, height: 68, borderRadius: '50%', cursor: unlocked ? 'pointer' : 'default',
                          background: unlocked
                            ? `radial-gradient(circle at 32% 26%, ${GOLD} 0%, #d98a1e 80%)`
                            : 'rgba(255,255,255,0.06)',
                          border: unlocked ? '2.5px solid rgba(255,255,255,0.35)' : '2px dashed rgba(255,255,255,0.16)',
                          color: unlocked ? INK : 'rgba(255,255,255,0.4)',
                          fontFamily: 'var(--font-display, inherit)', fontWeight: 800, fontSize: unlocked ? 22 : 18,
                          boxShadow: unlocked ? `0 10px 24px -8px ${GOLD}88` : 'none',
                          animation: isNext && !reducedMotion ? 'dqNodePulse 1.8s ease-out infinite' : 'none',
                          position: 'relative',
                        }}>
                        {unlocked ? (i + 1) : '🔒'}
                        <span style={{ position: 'absolute', top: -9, insetInlineEnd: -9, fontSize: 17 }}>{ZONE_EMOJI[zone]}</span>
                      </button>
                      <StarsRow n={sc} size={12} />
                      {gateBlocked && (
                        <div className="fs-mono" style={{ fontSize: 9, color: GOLD, fontWeight: 800 }}>
                          {interp(t.duoq_gate_need || 'NEEDS {n}⭐', { n: STAR_GATES[i] })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {/* First-visit hint */}
              {season.runs === 0 && (
                <div className="fs-sans a-fade-up" style={{ margin: '14px 24px 0', textAlign: 'center', fontSize: 12.5, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
                  {t.duoq_map_hint || 'Every level is built from a slice of your real chat. Find the buried 💌, beat the Gatekeeper, earn ⭐.'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ════════ RUN ════════ */}
      {screen === 'run' && (
        <div style={{ position: 'absolute', inset: 0 }}>
          <RunCanvas
            key={`${A}|${B}|${levelIdx}|${runId}`}
            level={level}
            playerName={A}
            partnerName={B}
            trailColor={GOLD}
            doubleJump={hasDoubleJump}
            paused={overlay !== null}
            reducedMotion={reducedMotion}
            isRTL={isRTL}
            labels={{
              hint: t.duoq_hint_hold || 'TAP = JUMP · HOLD = HIGHER',
              combo: t.duoq_combo || 'COMBO',
              assist: interp(t.duoq_assist || '{b} ASSIST!', { b: (B || '').toUpperCase() }),
            }}
            onCapsule={() => setOverlay('capsule')}
            onFinish={handleFinish}
            onDead={(s) => { setRunStats(s); setOverlay('dead'); }}
          />
          {/* Floating run chrome — RTL-aware positioning */}
          <div style={{ position: 'absolute', top: 'calc(env(safe-area-inset-top, 0px) + 8px)', ...(isRTL ? { insetInlineStart: 10 } : { insetInlineEnd: 10 }), display: 'flex', gap: 8 }}>
            <button onClick={() => setOverlay('paused')} className="press" style={runBtn}>⏸</button>
          </div>
          <div className="fs-mono" style={{ position: 'absolute', top: 'calc(env(safe-area-inset-top, 0px) + 12px)', ...(isRTL ? { insetInlineEnd: 12 } : { insetInlineStart: 12 }), fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.55)' }}>
            {levelName(levelIdx)}
          </div>
        </div>
      )}

      {/* ════════ RESULTS ════════ */}
      {screen === 'results' && runStats && (
        <div className="a-fade-up" style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 22px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          {/* confetti */}
          {!reducedMotion && Array.from({ length: 10 }, (_, i) => (
            <span key={i} className="a-float" style={{
              position: 'absolute', bottom: 100, left: `${8 + i * 9}%`, fontSize: 18,
              animationDelay: `${i * 0.22}s`, animationDuration: '2.6s',
            }}>
              {['⭐', '💌', '✨'][i % 3]}
            </span>
          ))}
          <div className="fs-mono" style={{ fontSize: 10, letterSpacing: '0.26em', fontWeight: 800, color: GOLD, textTransform: 'uppercase' }}>
            {levelName(levelIdx)} · {t.duoq_clear || 'CLEAR!'}
          </div>
          <div style={{ display: 'flex', gap: 8, margin: '18px 0 8px' }}>
            {[0, 1, 2].map(i => (
              <span key={i} style={{
                fontSize: 46, opacity: i < runStats.stars ? 1 : 0.22,
                animation: i < runStats.stars ? `dqStar 0.5s cubic-bezier(0.34,1.56,0.64,1) ${0.25 + i * 0.28}s both` : 'none',
                filter: i < runStats.stars ? `drop-shadow(0 0 12px ${GOLD})` : 'none',
              }}>⭐</span>
            ))}
          </div>
          <div className="fs-mono" style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span>✅ {t.duoq_star_finish || 'Finished the run'}</span>
            <span style={{ opacity: runStats.capsule ? 1 : 0.4 }}>{runStats.capsule ? '✅' : '✖️'} 💌 {t.duoq_star_capsule || 'Memory found'}</span>
            {runStats.bossCorrect != null && (
              <span style={{ opacity: runStats.bossCorrect ? 1 : 0.4 }}>{runStats.bossCorrect ? '✅' : '✖️'} 🔮 {t.duoq_star_boss || 'Gatekeeper bet won'}</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 18, marginTop: 18 }}>
            <div style={statBox}><div style={statNum}>{runStats.coins}</div><div style={statLbl}>{t.duoq_stat_coins || 'memories'}</div></div>
            <div style={statBox}><div style={statNum}>×{runStats.comboBest}</div><div style={statLbl}>{t.duoq_combo || 'COMBO'}</div></div>
            <div style={statBox}><div style={statNum}>{stars}</div><div style={statLbl}>⭐ {t.duoq_stat_total || 'total'}</div></div>
          </div>
          {runStats.bossCorrect != null && question && (
            <div className="fs-sans" dir="auto" style={{ marginTop: 16, fontSize: 13.5, lineHeight: 1.5, color: 'rgba(255,255,255,0.75)', maxWidth: 290 }}>
              {interp(t[`duoq_q_${question.id}_win`] || '', bossVars())}
            </div>
          )}
          {stars >= DOUBLE_JUMP_AT && stars - runStats.stars < DOUBLE_JUMP_AT && (
            <div className="fs-display a-spring" style={{ marginTop: 14, color: PARTNER_COLOR, fontWeight: 800, fontSize: 15 }}>
              🪽 {t.duoq_double_jump_new || 'DOUBLE JUMP UNLOCKED!'}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 300, marginTop: 26 }}>
            {levelIdx + 1 < LEVEL_COUNT && isUnlocked(save, sk, levelIdx + 1) ? (
              <BigButton onClick={() => startRun(levelIdx + 1)}>
                {'NEXT: ' + levelName(levelIdx + 1)}
              </BigButton>
            ) : (
              <BigButton onClick={() => startRun(levelIdx)}>REPLAY</BigButton>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <BigButton ghost onClick={shareRun} style={{ flex: 1 }}>📤 {t.duoq_share || 'Share'}</BigButton>
              <BigButton ghost onClick={() => setScreen('map')} style={{ flex: 1 }}>🗺 {t.duoq_map || 'Map'}</BigButton>
            </div>
          </div>
        </div>
      )}

      {/* ════════ OVERLAYS ════════ */}

      {/* Level intro */}
      {overlay === 'intro' && (
        <Modal>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40 }}>{ZONE_EMOJI[Math.min(3, Math.floor(levelIdx / 2))]}</div>
            <div className="fs-display" style={{ fontSize: 24, fontWeight: 800, color: '#fff', marginTop: 6 }}>{levelName(levelIdx)}</div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
              {level.storm && <span style={modChip}>⛈ {t.duoq_mod_storm || 'Chaos storm'}</span>}
              {level.stalker && <span style={modChip}>👻 {t.duoq_mod_ghost || 'The Great Silence'}</span>}
              {level.night && <span style={modChip}>🌙 {t.duoq_mod_night || 'Night shift'}</span>}
              {!level.storm && !level.stalker && !level.night && <span style={modChip}>☀️ {t.duoq_mod_calm || 'Clear skies'}</span>}
            </div>
            <div style={{ marginTop: 12 }}><StarsRow n={season.stars[levelIdx] || 0} size={20} /></div>
            <div className="fs-mono" style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 8 }}>
              {save.artifacts[artifacts[levelIdx].id]
                ? `💌 ${t.duoq_capsule_found_short || 'Memory recovered'}`
                : `💌 ${t.duoq_capsule_hidden || 'A memory is buried here…'}`}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <BigButton ghost onClick={() => setOverlay(null)} style={{ flex: 1 }}>{t.duoq_not_yet || 'Not yet'}</BigButton>
              <BigButton onClick={() => startRun(levelIdx)} style={{ flex: 1.6 }}>{t.duoq_run || 'RUN'}</BigButton>
            </div>
          </div>
        </Modal>
      )}

      {/* Memory capsule */}
      {overlay === 'capsule' && (
        <Modal>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 46, animation: 'dqEnvelope 0.55s cubic-bezier(0.34,1.56,0.64,1) both' }}>💌</div>
            <div className="fs-mono" style={{ fontSize: 10, letterSpacing: '0.24em', fontWeight: 800, color: GOLD, textTransform: 'uppercase', marginTop: 6 }}>
              {t.duoq_capsule_eyebrow || 'MEMORY RECOVERED'}
            </div>
            <div className="fs-display" style={{ fontSize: 21, fontWeight: 800, color: '#fff', margin: '6px 0 14px' }}>
              {artifacts[levelIdx].icon} {t[`duoq_art_${artifacts[levelIdx].type}_title`] || artifacts[levelIdx].type}
            </div>
            <div style={{ textAlign: 'start', animation: 'dqRise 0.5s 0.25s cubic-bezier(0.16,1,0.3,1) both' }}>
              <ArtifactBody art={artifacts[levelIdx]} t={t} A={A} B={B} />
            </div>
            <BigButton onClick={() => setOverlay(null)} style={{ marginTop: 18 }}>
              {t.duoq_keep_running || 'KEEP RUNNING'}
            </BigButton>
          </div>
        </Modal>
      )}

      {/* Gatekeeper boss bet */}
      {overlay === 'boss' && question && (
        <Modal>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 44 }}>{question.emoji}</div>
            <div className="fs-mono" style={{ fontSize: 10, letterSpacing: '0.24em', fontWeight: 800, color: GOLD, textTransform: 'uppercase', marginTop: 6 }}>
              {t.duoq_boss_eyebrow || 'THE GATEKEEPER'}
            </div>
            <div className="fs-display" dir="auto" style={{ fontSize: 20, fontWeight: 800, color: '#fff', margin: '8px 0 4px', lineHeight: 1.2 }}>
              {t[`duoq_q_${question.id}`] || question.id}
            </div>
            <div className="fs-sans" style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
              {t.duoq_boss_sub || 'Bet right, earn a star. No pressure.'}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              {['A', 'B'].map(side => {
                const name = side === 'A' ? A : B;
                const color = side === 'A' ? PLAYER_COLOR : PARTNER_COLOR;
                const isAnswer = bossPick && question.answer === side;
                const isPick = bossPick === side;
                return (
                  <button key={side} disabled={!!bossPick} onClick={() => answerBoss(side)}
                    className={bossPick ? '' : 'press'} style={{
                      flex: 1, padding: '14px 8px', borderRadius: 16, cursor: bossPick ? 'default' : 'pointer',
                      background: isAnswer ? `${color}33` : 'rgba(255,255,255,0.05)',
                      border: `2px solid ${isAnswer ? color : isPick ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.12)'}`,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                      opacity: bossPick && !isAnswer && !isPick ? 0.45 : 1,
                      transition: 'all 0.25s ease',
                    }}>
                    <Avatar name={name} color={color} size={44} />
                    <span dir="auto" className="fs-display" style={{ color: '#fff', fontWeight: 800, fontSize: 14, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                    {bossPick && (
                      <span className="fs-mono" style={{ fontSize: 13, fontWeight: 800, color: isAnswer ? color : 'rgba(255,255,255,0.45)' }}>
                        {question.fmt(side === 'A' ? question.valA : question.valB)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {bossPick && (
              <div className="a-fade-up" style={{ marginTop: 14 }}>
                <div className="fs-display" style={{ fontSize: 18, fontWeight: 800, color: bossDone ? GOLD : '#fb7185' }}>
                  {bossDone ? `⭐ ${t.duoq_boss_right || 'CALLED IT!'}` : `😮 ${t.duoq_boss_wrong || 'PLOT TWIST!'}`}
                </div>
                <div className="fs-sans" dir="auto" style={{ fontSize: 13.5, lineHeight: 1.5, color: 'rgba(255,255,255,0.78)', marginTop: 6 }}>
                  {interp(t[`duoq_q_${question.id}_win`] || '', bossVars())}
                </div>
                <BigButton onClick={() => completeRun(runStats, bossDone)} style={{ marginTop: 14 }}>
                  {t.duoq_claim || 'CLAIM THE RUN'}
                </BigButton>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Pause */}
      {overlay === 'paused' && (
        <Modal>
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="fs-display" style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 6 }}>⏸ {t.duoq_paused || 'Paused'}</div>
            <BigButton onClick={() => setOverlay(null)}>{t.duoq_resume || 'RESUME'}</BigButton>
            <BigButton ghost onClick={() => startRun(levelIdx)}>RESTART</BigButton>
            <BigButton ghost onClick={() => { setOverlay(null); setScreen('map'); }}>🗺 {t.duoq_map || 'Map'}</BigButton>
          </div>
        </Modal>
      )}

      {/* Death */}
      {overlay === 'dead' && (
        <Modal>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 46 }}>💔</div>
            <div className="fs-display" style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginTop: 6 }}>
              {t.duoq_dead_title || 'The chat went quiet…'}
            </div>
            <div className="fs-sans" style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 6 }}>
              {t.duoq_dead_sub || 'Every long run has its rough patch.'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 18 }}>
              <BigButton onClick={() => startRun(levelIdx)}>RETRY</BigButton>
              <BigButton ghost onClick={() => { setOverlay(null); setScreen('map'); }}>🗺 {t.duoq_map || 'Map'}</BigButton>
            </div>
          </div>
        </Modal>
      )}

      {/* Pair picker */}
      {overlay === 'picker' && (
        <Sheet onClose={() => setOverlay(null)}>
          <div className="fs-mono" style={{ fontSize: 10, letterSpacing: '0.2em', fontWeight: 800, color: GOLD, textTransform: 'uppercase', textAlign: 'center', marginBottom: 12 }}>
            {t.duoq_pick_partner || 'Who runs with you?'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {users.map((u) => {
              const isA = u.author === A, isB = u.author === B;
              return (
                <div key={u.author} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 14,
                  background: isA || isB ? 'rgba(249,199,79,0.08)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${isA || isB ? `${GOLD}44` : 'rgba(255,255,255,0.08)'}`,
                }}>
                  <Avatar name={u.author} color={isA ? PLAYER_COLOR : isB ? PARTNER_COLOR : 'rgba(255,255,255,0.35)'} size={34} />
                  <div dir="auto" style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.author}</div>
                  <button onClick={() => pickPair(u.author, 'A')} className="press" disabled={isA}
                    style={{ ...slotBtn, borderColor: isA ? PLAYER_COLOR : 'rgba(255,255,255,0.2)', color: isA ? PLAYER_COLOR : 'rgba(255,255,255,0.6)' }}>
                    {t.duoq_slot_you || 'RUNNER'}
                  </button>
                  <button onClick={() => pickPair(u.author, 'B')} className="press" disabled={isB}
                    style={{ ...slotBtn, borderColor: isB ? PARTNER_COLOR : 'rgba(255,255,255,0.2)', color: isB ? PARTNER_COLOR : 'rgba(255,255,255,0.6)' }}>
                    {t.duoq_slot_partner || 'PARTNER'}
                  </button>
                </div>
              );
            })}
          </div>
        </Sheet>
      )}

      {/* Album */}
      {overlay === 'album' && (
        <Sheet onClose={() => setOverlay(null)}>
          <div className="fs-mono" style={{ fontSize: 10, letterSpacing: '0.2em', fontWeight: 800, color: GOLD, textTransform: 'uppercase', textAlign: 'center' }}>
            💌 {t.duoq_album_title || 'MEMORY ALBUM'} · {foundCount}/{albumItems.length}
          </div>
          <div className="fs-sans" style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.45)', textAlign: 'center', margin: '6px 0 14px' }}>
            {t.duoq_album_sub || 'Real moments dug out of your chat. Find them all.'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {albumItems.map((art) => (
              <div key={art.id} style={{
                borderRadius: 16, padding: '14px 14px',
                background: art.found ? 'linear-gradient(160deg, rgba(249,199,79,0.10) 0%, rgba(255,255,255,0.03) 100%)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${art.found ? `${GOLD}3a` : 'rgba(255,255,255,0.08)'}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: art.found ? 8 : 0 }}>
                  <span style={{ fontSize: 22, filter: art.found ? 'none' : 'grayscale(1) brightness(0.5)' }}>{art.found ? art.icon : '🔒'}</span>
                  <div className="fs-display" style={{ fontSize: 15, fontWeight: 800, color: art.found ? '#fff' : 'rgba(255,255,255,0.4)' }}>
                    {art.found
                      ? (t[`duoq_art_${art.type}_title`] || art.type)
                      : (t[`duoq_art_${art.type}_hint`] || t.duoq_art_locked || 'Still buried out there…')}
                  </div>
                </div>
                {art.found && <ArtifactBody art={art} t={t} A={A} B={B} />}
              </div>
            ))}
          </div>
        </Sheet>
      )}
    </div>
  );
}

const hdrBtn = {
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)',
  color: '#fff', padding: '7px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700,
  cursor: 'pointer', backdropFilter: 'blur(8px)',
};
const runBtn = {
  width: 38, height: 38, borderRadius: '50%', fontSize: 15,
  background: 'rgba(10,11,18,0.45)', border: '1px solid rgba(255,255,255,0.2)',
  color: '#fff', cursor: 'pointer', backdropFilter: 'blur(6px)',
};
const pairChip = {
  display: 'flex', alignItems: 'center', gap: 7, padding: '5px 12px 5px 6px',
  borderRadius: 999, background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.14)', cursor: 'pointer',
};
const pairName = {
  color: '#fff', fontSize: 13, fontWeight: 700, maxWidth: 90,
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
};
const modChip = {
  fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.8)',
  background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.14)',
  borderRadius: 999, padding: '4px 10px',
};
const slotBtn = {
  fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', padding: '6px 9px',
  borderRadius: 999, background: 'transparent', border: '1.5px solid', cursor: 'pointer',
};
const statBox = { textAlign: 'center', minWidth: 70 };
const statNum = { fontSize: 24, fontWeight: 800, color: '#fff', fontFamily: 'var(--font-display, inherit)' };
const statLbl = { fontSize: 10, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 2 };
