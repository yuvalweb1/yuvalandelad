import { useState, useMemo } from 'react';
import { interp } from '../i18n';

// ── Duo mode = "THE VERSUS": a head-to-head championship bout between two
//    members of the chat. Pre-seeded with the chat's tightest duo, swappable
//    from either corner. A series of data-driven rounds, each revealed with a
//    tap, builds a running scorecard until one fighter takes the belt.
//    Every round is drawn from already-computed analytics — no new metrics,
//    just head-to-head selection. Deterministic.

const RED = '#e8533a';      // red corner (fighter A)
const BLUE = '#3b82f6';     // blue corner (fighter B)
const GOLD = '#f9c74f';     // the belt / neutral championship accent
const cornerColor = (side) => (side === 'A' ? RED : BLUE);

function fmtMin(m) {
  if (m == null) return '—';
  return m < 60 ? `${Math.round(m)}m` : `${(m / 60).toFixed(1)}h`;
}
const fmtNum = (n) => Math.round(n).toLocaleString();
const fmtPct = (n) => `${Math.round(n)}%`;
const fmtDays = (n) => `${Math.round(n)}d`;
const fmtWords = (n) => n.toFixed(1);

function Avatar({ name, side, size = 56 }) {
  const c = cornerColor(side);
  return (
    <div className="fs-display" style={{
      width: size, height: size, borderRadius: '50%',
      background: `radial-gradient(circle at 30% 25%, ${c} 0%, ${c}cc 70%)`,
      color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.42, fontWeight: 800, letterSpacing: '-0.04em',
      flexShrink: 0, border: '2px solid rgba(255,255,255,0.22)',
      boxShadow: `inset 0 -3px 0 rgba(0,0,0,0.30), 0 6px 22px ${c}66`,
    }}>
      {(name || '?')[0].toUpperCase()}
    </div>
  );
}

// Build the ordered list of head-to-head rounds for the chosen pair.
// Each candidate carries both raw values, who wins, and the i18n keys for
// its label / verdict. We keep only decisive (non-tie, eligible) categories,
// then force an ODD count so the bout can never end in a draw.
function buildRounds(analytics, A, B) {
  const ua = analytics.userMap[A];
  const ub = analytics.userMap[B];
  if (!ua || !ub) return [];
  const rm = analytics.replyMatrix || {};
  const aToB = (rm[A] && rm[A][B]) || 0; // A replied to B
  const bToA = (rm[B] && rm[B][A]) || 0;

  const speedEligible =
    ua.respSampleSize >= 5 && ub.respSampleSize >= 5 &&
    ua.avgRespMin != null && ub.avgRespMin != null;

  const candidates = [
    { id: 'volume',    emoji: '💬', valA: ua.messageCount,        valB: ub.messageCount,        higherWins: true,  fmt: fmtNum },
    { id: 'speed',     emoji: '⚡', valA: ua.avgRespMin,          valB: ub.avgRespMin,          higherWins: false, fmt: fmtMin, eligible: speedEligible },
    { id: 'chase',     emoji: '🎯', valA: aToB,                   valB: bToA,                   higherWins: true,  fmt: fmtNum, eligible: (aToB + bToA) > 0 },
    { id: 'night',     emoji: '🌙', valA: ua.nightPct,            valB: ub.nightPct,            higherWins: true,  fmt: fmtPct, eligible: (ua.nightMessages + ub.nightMessages) > 0 },
    { id: 'words',     emoji: '📜', valA: ua.avgWordsPerMsg,      valB: ub.avgWordsPerMsg,      higherWins: true,  fmt: fmtWords },
    { id: 'emoji',     emoji: '😎', valA: ua.emojiCount,          valB: ub.emojiCount,          higherWins: true,  fmt: fmtNum, eligible: (ua.emojiCount + ub.emojiCount) > 0 },
    { id: 'streak',    emoji: '🔥', valA: ua.longestStreak,       valB: ub.longestStreak,       higherWins: true,  fmt: fmtDays },
    { id: 'reviver',   emoji: '🫀', valA: ua.conversationsRevived, valB: ub.conversationsRevived, higherWins: true, fmt: fmtNum, eligible: (ua.conversationsRevived + ub.conversationsRevived) > 0 },
    { id: 'questions', emoji: '❓', valA: ua.questionCount,       valB: ub.questionCount,       higherWins: true,  fmt: fmtNum, eligible: (ua.questionCount + ub.questionCount) > 0 },
    { id: 'love',      emoji: '❤️', valA: ua.loveYouCount,        valB: ub.loveYouCount,        higherWins: true,  fmt: fmtNum, eligible: (ua.loveYouCount + ub.loveYouCount) > 0 },
    { id: 'media',     emoji: '📸', valA: ua.mediaCount,          valB: ub.mediaCount,          higherWins: true,  fmt: fmtNum, eligible: (ua.mediaCount + ub.mediaCount) > 0 },
    { id: 'voice',     emoji: '🎤', valA: ua.voiceCount,          valB: ub.voiceCount,          higherWins: true,  fmt: fmtNum, eligible: (ua.voiceCount + ub.voiceCount) > 0 },
  ];

  const rounds = [];
  for (const c of candidates) {
    if (c.eligible === false) continue;
    const a = c.valA, b = c.valB;
    if (a == null || b == null) continue;
    const winner = c.higherWins
      ? (a > b ? 'A' : b > a ? 'B' : null)
      : (a < b ? 'A' : b < a ? 'B' : null);
    if (!winner) continue; // skip exact ties — no contest

    // perf = how "full" each fighter's bar should look (winner always fuller)
    let perfA, perfB;
    if (c.higherWins) {
      const max = Math.max(a, b, 1e-9);
      perfA = a / max; perfB = b / max;
    } else {
      const min = Math.min(a, b);
      perfA = a > 0 ? min / a : 1;
      perfB = b > 0 ? min / b : 1;
    }
    rounds.push({ ...c, winner, perfA, perfB });
  }

  let chosen = rounds.slice(0, 7);
  if (chosen.length % 2 === 0 && chosen.length > 1) chosen = chosen.slice(0, chosen.length - 1);
  return chosen;
}

// ── Corner card on the weigh-in screen ─────────────────────────────────────
function CornerCard({ side, name, label, onSwap, t }) {
  const c = cornerColor(side);
  return (
    <button onClick={onSwap} className="press" style={{
      flex: 1, minWidth: 0, position: 'relative', overflow: 'hidden',
      background: `linear-gradient(160deg, ${c}26 0%, rgba(10,11,18,0.4) 100%)`,
      border: `1.5px solid ${c}66`, borderRadius: 20,
      padding: '18px 12px 16px', cursor: 'pointer', color: '#fff',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
      boxShadow: `0 14px 34px -16px ${c}aa`,
    }}>
      <div style={{ position: 'absolute', top: -40, left: '50%', transform: 'translateX(-50%)', width: 120, height: 120, borderRadius: '50%', background: c, opacity: 0.22, filter: 'blur(42px)', pointerEvents: 'none' }} />
      <div className="fs-mono" style={{ position: 'relative', fontSize: 9, letterSpacing: '0.2em', fontWeight: 800, color: c, textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ position: 'relative' }}><Avatar name={name} side={side} size={64} /></div>
      <div className="fs-display" dir="auto" style={{
        position: 'relative', fontSize: 18, fontWeight: 800, letterSpacing: '-0.03em',
        textAlign: 'center', lineHeight: 1.05, maxWidth: '100%',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {name}
      </div>
      <div className="fs-mono" style={{
        position: 'relative', fontSize: 9, letterSpacing: '0.14em', fontWeight: 700,
        color: 'rgba(255,255,255,0.42)', textTransform: 'uppercase',
        border: '1px solid rgba(255,255,255,0.16)', borderRadius: 999, padding: '3px 9px',
      }}>
        ⇄ {t.duo_pick_fighter || 'Swap'}
      </div>
    </button>
  );
}

// ── Roster picker overlay ──────────────────────────────────────────────────
function RosterPicker({ users, exclude, side, onPick, onClose, t }) {
  const c = cornerColor(side);
  return (
    <div onClick={onClose} style={{
      position: 'absolute', inset: 0, zIndex: 80,
      background: 'rgba(6,7,12,0.66)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'flex-end',
      animation: 'duoFade 0.18s ease-out',
    }}>
      <div onClick={(e) => e.stopPropagation()} className="no-sb" style={{
        width: '100%', maxHeight: '74%', overflowY: 'auto',
        background: 'linear-gradient(180deg, #181b2c 0%, #0e0f18 100%)',
        borderRadius: '24px 24px 0 0', border: '1px solid rgba(255,255,255,0.10)',
        borderBottom: 'none', padding: '18px 16px calc(env(safe-area-inset-bottom, 0px) + 20px)',
        boxShadow: '0 -20px 50px rgba(0,0,0,0.6)',
        animation: 'duoSheetUp 0.26s cubic-bezier(0.16,1,0.3,1)',
      }}>
        <div style={{ width: 38, height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.22)', margin: '0 auto 14px' }} />
        <div className="fs-mono" style={{ fontSize: 10, letterSpacing: '0.2em', fontWeight: 800, color: c, textTransform: 'uppercase', textAlign: 'center', marginBottom: 12 }}>
          {t.duo_pick_fighter || 'Pick a fighter'}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {users.map((u) => {
            const disabled = u.author === exclude;
            return (
              <button key={u.author} disabled={disabled}
                onClick={() => onPick(u.author)} className={disabled ? '' : 'press'}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
                  padding: '10px 12px', borderRadius: 14, cursor: disabled ? 'default' : 'pointer',
                  background: disabled ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${disabled ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.10)'}`,
                  opacity: disabled ? 0.4 : 1, color: '#fff', width: '100%',
                }}>
                <Avatar name={u.author} side={side} size={38} />
                <div dir="auto" style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {u.author}
                </div>
                <div className="fs-mono" style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', fontWeight: 700 }}>
                  {fmtNum(u.messageCount)}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Score pips strip shown during the bout ─────────────────────────────────
function ScoreStrip({ rounds, results, roundIdx, t }) {
  const scoreA = results.filter((r) => r === 'A').length;
  const scoreB = results.filter((r) => r === 'B').length;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', marginTop: 4 }}>
      <span className="fs-display" style={{ fontSize: 20, fontWeight: 800, color: RED, minWidth: 18, textAlign: 'right' }}>{scoreA}</span>
      <div style={{ display: 'flex', gap: 5 }}>
        {rounds.map((_, i) => {
          const r = results[i];
          const isCurrent = i === roundIdx;
          const bg = r === 'A' ? RED : r === 'B' ? BLUE : 'rgba(255,255,255,0.16)';
          return (
            <div key={i} style={{
              width: isCurrent ? 9 : 7, height: isCurrent ? 9 : 7, borderRadius: '50%',
              background: bg, transition: 'all 0.2s ease',
              boxShadow: r ? `0 0 8px ${bg}` : 'none',
              border: isCurrent && !r ? `1.5px solid ${GOLD}` : 'none',
            }} />
          );
        })}
      </div>
      <span className="fs-display" style={{ fontSize: 20, fontWeight: 800, color: BLUE, minWidth: 18, textAlign: 'left' }}>{scoreB}</span>
    </div>
  );
}

// ── One fighter's bar within a round ───────────────────────────────────────
function FighterBar({ side, name, value, perf, revealed, isWinner }) {
  const c = cornerColor(side);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <Avatar name={name} side={side} size={40} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
          <span dir="auto" className="fs-display" style={{ fontSize: 14, fontWeight: 800, letterSpacing: '-0.02em', color: revealed && isWinner ? '#fff' : 'rgba(255,255,255,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>
            {name}{revealed && isWinner ? ' 👑' : ''}
          </span>
          <span className="fs-mono" style={{ fontSize: 15, fontWeight: 800, color: revealed ? c : 'rgba(255,255,255,0.3)' }}>
            {revealed ? value : '···'}
          </span>
        </div>
        <div style={{ height: 9, borderRadius: 999, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 999,
            width: revealed ? `${Math.max(8, perf * 100)}%` : '0%',
            background: `linear-gradient(90deg, ${c}aa, ${c})`,
            boxShadow: revealed && isWinner ? `0 0 12px ${c}` : 'none',
            transition: 'width 0.7s cubic-bezier(0.16,1,0.3,1)',
            opacity: revealed && !isWinner ? 0.55 : 1,
          }} />
        </div>
      </div>
    </div>
  );
}

export default function DuoAnalysis({ analytics, selectedAuthor, t, onBack }) {
  const users = analytics.users || [];

  // Seed the corners: chat's tightest duo if available, else the two loudest.
  // If we arrived with a selected author, make sure they're in the ring.
  const [fighterA, fighterB] = useMemo(() => {
    const names = users.map((u) => u.author);
    let a, b;
    if (analytics.topDuo && analytics.topDuo.names?.length === 2) {
      [a, b] = analytics.topDuo.names;
    } else {
      a = names[0]; b = names[1];
    }
    if (selectedAuthor && names.includes(selectedAuthor) && selectedAuthor !== a && selectedAuthor !== b) {
      b = selectedAuthor;
    }
    return [a, b];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [A, setA] = useState(fighterA);
  const [B, setB] = useState(fighterB);
  const [phase, setPhase] = useState('tale'); // tale | battle | verdict
  const [picking, setPicking] = useState(null); // null | 'A' | 'B'
  const [roundIdx, setRoundIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState([]); // winners of completed rounds

  const rounds = useMemo(() => buildRounds(analytics, A, B), [analytics, A, B]);

  // Changing a fighter resets the bout back to the weigh-in.
  function pickFighter(name) {
    if (picking === 'A') setA(name);
    else if (picking === 'B') setB(name);
    setPicking(null);
    setPhase('tale');
    setRoundIdx(0); setRevealed(false); setResults([]);
  }

  function startBout() {
    if (!A || !B || A === B || rounds.length === 0) return;
    setRoundIdx(0); setRevealed(false); setResults([]);
    setPhase('battle');
  }

  function advance() {
    const winner = rounds[roundIdx].winner;
    const next = [...results, winner];
    if (roundIdx >= rounds.length - 1) {
      setResults(next);
      setPhase('verdict');
    } else {
      setResults(next);
      setRoundIdx(roundIdx + 1);
      setRevealed(false);
    }
  }

  function rematch() {
    setRoundIdx(0); setRevealed(false); setResults([]); setPhase('tale');
  }

  const arenaBg = 'radial-gradient(ellipse at 50% -8%, #232744 0%, #0c0d15 64%)';

  return (
    <div className="no-sb" style={{ height: '100%', overflowY: 'auto', position: 'relative', background: arenaBg }}>
      <style>{`
        @keyframes duoFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes duoSheetUp { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes duoStamp { 0% { transform: scale(2.4) rotate(-14deg); opacity: 0; } 55% { transform: scale(0.9) rotate(-6deg); opacity: 1; } 100% { transform: scale(1) rotate(-6deg); opacity: 1; } }
        @keyframes duoBeltIn { from { transform: scale(0.6) translateY(18px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }
        @keyframes duoPulse { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }
      `}</style>

      {/* atmosphere */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: -90, left: -70, width: 240, height: 240, borderRadius: '50%', background: RED, opacity: 0.16, filter: 'blur(80px)' }} />
        <div style={{ position: 'absolute', top: -90, right: -70, width: 240, height: 240, borderRadius: '50%', background: BLUE, opacity: 0.16, filter: 'blur(80px)' }} />
        <div style={{ position: 'absolute', bottom: -80, left: '50%', transform: 'translateX(-50%)', width: 260, height: 260, borderRadius: '50%', background: GOLD, opacity: 0.07, filter: 'blur(80px)' }} />
      </div>

      <div style={{ position: 'relative', zIndex: 1, padding: 'calc(env(safe-area-inset-top, 0px) + 20px) 18px calc(env(safe-area-inset-bottom, 0px) + 28px)', minHeight: '100%', display: 'flex', flexDirection: 'column' }}>

        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <button onClick={onBack} className="press" style={{
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)',
            color: '#fff', padding: '8px 14px', borderRadius: 999, fontSize: 13, fontWeight: 700,
            cursor: 'pointer', backdropFilter: 'blur(8px)',
          }}>
            {t.rm_back || '← Back'}
          </button>
          <div className="fs-mono" style={{
            fontSize: 10, color: '#1a1206', letterSpacing: '0.22em', fontWeight: 800, textTransform: 'uppercase',
            padding: '5px 10px 4px', borderRadius: 4, background: GOLD, transform: 'rotate(-2deg)',
            boxShadow: `0 4px 12px ${GOLD}66`,
          }}>
            {t.duo_vs_eyebrow || '✦ THE VERSUS'}
          </div>
        </div>

        {/* ── WEIGH-IN ─────────────────────────────────────────────── */}
        {phase === 'tale' && (
          <div className="a-fade-up" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ textAlign: 'center', marginBottom: 18 }}>
              <div className="fs-display" style={{ fontSize: 34, fontWeight: 800, color: '#fff', letterSpacing: '-0.035em', lineHeight: 1.02 }}>
                {t.duo_vs_title || 'Tale of the Tape'}
              </div>
              <div className="fs-sans" style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 6, maxWidth: 280, marginInline: 'auto' }}>
                {t.duo_vs_sub || 'Two fighters. One belt. Tap a corner to swap.'}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'stretch', gap: 10 }}>
              <CornerCard side="A" name={A} label={t.duo_corner_red || 'RED CORNER'} onSwap={() => setPicking('A')} t={t} />
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div className="fs-display" style={{
                  fontSize: 22, fontWeight: 800, color: GOLD, fontStyle: 'italic',
                  textShadow: `0 0 18px ${GOLD}77`, transform: 'rotate(-6deg)',
                }}>
                  {t.duo_vs_word || 'VS'}
                </div>
              </div>
              <CornerCard side="B" name={B} label={t.duo_corner_blue || 'BLUE CORNER'} onSwap={() => setPicking('B')} t={t} />
            </div>

            <div style={{ flex: 1 }} />

            {A === B ? (
              <div className="fs-sans" style={{ textAlign: 'center', fontSize: 13, color: GOLD, marginBottom: 14 }}>
                {t.duo_need_two || 'Need two different people to start the bout.'}
              </div>
            ) : (
              <div className="fs-mono" style={{ textAlign: 'center', fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.14em', marginBottom: 14, textTransform: 'uppercase' }}>
                {interp(t.duo_round_count || '{n} rounds · best record takes the belt', { n: rounds.length })}
              </div>
            )}

            <button onClick={startBout} disabled={A === B || rounds.length === 0} className="press" style={{
              width: '100%', padding: '16px', borderRadius: 18, border: 'none',
              cursor: A === B ? 'default' : 'pointer', opacity: A === B || rounds.length === 0 ? 0.4 : 1,
              background: `linear-gradient(135deg, ${GOLD} 0%, #FF8C00 100%)`,
              color: '#1a1206', fontFamily: 'var(--font-display)', fontWeight: 800,
              fontSize: 19, letterSpacing: '-0.01em',
              boxShadow: `0 8px 0 rgba(0,0,0,0.35), 0 16px 30px -8px ${GOLD}88`,
            }}>
              {t.duo_fight || 'FIGHT →'}
            </button>
          </div>
        )}

        {/* ── BATTLE ───────────────────────────────────────────────── */}
        {phase === 'battle' && rounds[roundIdx] && (() => {
          const r = rounds[roundIdx];
          const liveResults = revealed ? [...results.slice(0, roundIdx), r.winner] : results.slice(0, roundIdx);
          const winName = r.winner === 'A' ? A : B;
          const loseName = r.winner === 'A' ? B : A;
          const winVal = r.fmt(r.winner === 'A' ? r.valA : r.valB);
          const loseVal = r.fmt(r.winner === 'A' ? r.valB : r.valA);
          const isLast = roundIdx >= rounds.length - 1;
          return (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <ScoreStrip rounds={rounds} results={liveResults} roundIdx={roundIdx} t={t} />

              <div className="fs-mono" style={{ textAlign: 'center', fontSize: 10, letterSpacing: '0.24em', fontWeight: 800, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', marginTop: 16 }}>
                {interp(t.duo_round_of || 'ROUND {n} OF {total}', { n: roundIdx + 1, total: rounds.length })}
              </div>

              {/* category card */}
              <div key={roundIdx} className="a-fade-up" onClick={() => !revealed && setRevealed(true)} style={{
                marginTop: 12, position: 'relative', overflow: 'hidden',
                background: 'linear-gradient(165deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
                border: '1px solid rgba(255,255,255,0.12)', borderRadius: 24,
                padding: '24px 20px 22px', cursor: revealed ? 'default' : 'pointer',
                boxShadow: '0 22px 50px -18px rgba(0,0,0,0.7)',
              }}>
                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                  <div style={{ fontSize: 48, lineHeight: 1 }}>{r.emoji}</div>
                  <div className="fs-display" style={{ fontSize: 24, fontWeight: 800, color: '#fff', letterSpacing: '-0.03em', marginTop: 6 }}>
                    {t[`duo_cat_${r.id}_label`] || r.id}
                  </div>
                  <div className="fs-mono" style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.14em', textTransform: 'uppercase', marginTop: 4 }}>
                    {t[`duo_cat_${r.id}_sub`] || ''}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <FighterBar side="A" name={A} value={r.fmt(r.valA)} perf={r.perfA} revealed={revealed} isWinner={r.winner === 'A'} />
                  <FighterBar side="B" name={B} value={r.fmt(r.valB)} perf={r.perfB} revealed={revealed} isWinner={r.winner === 'B'} />
                </div>

                {!revealed && (
                  <div className="fs-mono" style={{
                    textAlign: 'center', marginTop: 20, fontSize: 12, fontWeight: 800,
                    letterSpacing: '0.22em', color: GOLD, textTransform: 'uppercase',
                    animation: 'duoPulse 1.4s ease-in-out infinite',
                  }}>
                    ☝ {t.duo_tap_reveal || 'TAP TO REVEAL'}
                  </div>
                )}

                {revealed && (
                  <div style={{ marginTop: 20 }}>
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 8,
                      background: cornerColor(r.winner), color: '#fff',
                      padding: '7px 14px', borderRadius: 999, fontFamily: 'var(--font-mono)',
                      fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase',
                      animation: 'duoStamp 0.5s cubic-bezier(0.34,1.56,0.64,1) both',
                      boxShadow: `0 8px 22px -6px ${cornerColor(r.winner)}`,
                    }}>
                      👑 {winName} · {t.duo_wins_round || 'WINS THE ROUND'}
                    </div>
                    <div className="fs-sans" dir="auto" style={{ fontSize: 14, lineHeight: 1.5, color: 'rgba(255,255,255,0.82)', marginTop: 12 }}>
                      {interp(t[`duo_cat_${r.id}_win`] || '', { w: winName, l: loseName, wv: winVal, lv: loseVal })}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ flex: 1 }} />

              {revealed && (
                <button onClick={advance} className="press a-fade-up" style={{
                  width: '100%', marginTop: 18, padding: '15px', borderRadius: 16, cursor: 'pointer',
                  background: isLast ? `linear-gradient(135deg, ${GOLD} 0%, #FF8C00 100%)` : 'rgba(255,255,255,0.10)',
                  color: isLast ? '#1a1206' : '#fff', border: isLast ? 'none' : '1px solid rgba(255,255,255,0.16)',
                  fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, letterSpacing: '-0.01em',
                  boxShadow: isLast ? `0 7px 0 rgba(0,0,0,0.35), 0 14px 26px -8px ${GOLD}88` : 'none',
                }}>
                  {isLast ? (t.duo_see_result || 'SEE THE VERDICT →') : (t.duo_next_round || 'NEXT ROUND →')}
                </button>
              )}
            </div>
          );
        })()}

        {/* ── VERDICT ──────────────────────────────────────────────── */}
        {phase === 'verdict' && (() => {
          const scoreA = results.filter((r) => r === 'A').length;
          const scoreB = results.filter((r) => r === 'B').length;
          const draw = scoreA === scoreB;
          const champSide = scoreA > scoreB ? 'A' : 'B';
          const champ = champSide === 'A' ? A : B;
          const loser = champSide === 'A' ? B : A;
          const ws = Math.max(scoreA, scoreB);
          const ls = Math.min(scoreA, scoreB);
          const c = cornerColor(champSide);
          const margin = ws - ls;
          const flavorKey = ls === 0 ? 'duo_champ_sweep' : margin === 1 ? 'duo_champ_close' : 'duo_champ_solid';

          return (
            <div className="a-fade-up" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
              <div className="fs-mono" style={{ fontSize: 10, letterSpacing: '0.26em', fontWeight: 800, color: GOLD, textTransform: 'uppercase' }}>
                {draw ? '✦ ✦ ✦' : (t.duo_champ_eyebrow || '✦ THE CHAMPION')}
              </div>

              {draw ? (
                <>
                  <div style={{ fontSize: 76, margin: '14px 0 4px', animation: 'duoBeltIn 0.5s cubic-bezier(0.34,1.56,0.64,1) both' }}>🤝</div>
                  <div className="fs-display" style={{ fontSize: 36, fontWeight: 800, color: '#fff', letterSpacing: '-0.035em' }}>
                    {t.duo_draw_title || "It's a DRAW."}
                  </div>
                  <div className="fs-sans" style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', marginTop: 8, maxWidth: 260 }}>
                    {t.duo_draw_sub || 'Dead even. You two deserve each other.'}
                  </div>
                </>
              ) : (
                <>
                  <div style={{ position: 'relative', margin: '18px 0 6px', animation: 'duoBeltIn 0.5s cubic-bezier(0.34,1.56,0.64,1) both' }}>
                    <div style={{ position: 'absolute', inset: -10, borderRadius: '50%', background: c, opacity: 0.3, filter: 'blur(34px)' }} />
                    <div style={{ position: 'relative' }}><Avatar name={champ} side={champSide} size={104} /></div>
                    <div style={{ position: 'absolute', top: -22, left: '50%', transform: 'translateX(-50%)', fontSize: 40 }}>👑</div>
                  </div>
                  <div className="fs-display" dir="auto" style={{ fontSize: 36, fontWeight: 800, color: '#fff', letterSpacing: '-0.04em', lineHeight: 1.02, marginTop: 10, padding: '0 8px' }}>
                    {interp(t.duo_champ_takes_belt || '{w} takes the belt.', { w: champ })}
                  </div>
                  <div className="fs-display" style={{
                    display: 'inline-block', marginTop: 12, padding: '8px 18px', borderRadius: 999,
                    background: GOLD, color: '#1a1206', fontWeight: 800, fontSize: 18, letterSpacing: '0.02em',
                    boxShadow: `0 8px 24px -6px ${GOLD}aa`,
                  }}>
                    🏆 {interp(t.duo_champ_score || 'Final: {ws}–{ls}', { ws, ls })}
                  </div>
                  <div className="fs-sans" dir="auto" style={{ fontSize: 14, lineHeight: 1.5, color: 'rgba(255,255,255,0.62)', marginTop: 16, maxWidth: 280 }}>
                    {interp(t[flavorKey] || '', { w: champ, l: loser })}
                  </div>
                </>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 28, width: '100%' }}>
                <button onClick={rematch} className="press" style={{
                  flex: 1, padding: '14px', borderRadius: 16, cursor: 'pointer',
                  background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.16)', color: '#fff',
                  fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15,
                }}>
                  {t.duo_rematch || '↺ Rematch'}
                </button>
                <button onClick={() => { rematch(); setPicking('B'); }} className="press" style={{
                  flex: 1, padding: '14px', borderRadius: 16, cursor: 'pointer', border: 'none',
                  background: `linear-gradient(135deg, ${GOLD} 0%, #FF8C00 100%)`, color: '#1a1206',
                  fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15,
                  boxShadow: `0 6px 0 rgba(0,0,0,0.3)`,
                }}>
                  {t.duo_new_duo || 'New duo'}
                </button>
              </div>

              <div className="fs-mono" style={{ marginTop: 22, fontSize: 9, color: 'rgba(255,255,255,0.34)', letterSpacing: '0.08em', lineHeight: 1.6 }}>
                {t.duo_footer || 'Every round drawn from this chat. No refs. No mercy.'}
              </div>
            </div>
          );
        })()}
      </div>

      {picking && (
        <RosterPicker
          users={users}
          exclude={picking === 'A' ? B : A}
          side={picking}
          onPick={pickFighter}
          onClose={() => setPicking(null)}
          t={t}
        />
      )}
    </div>
  );
}
