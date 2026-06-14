// ============================================================
// CaseScene — the LEAD → EVIDENCE → VERDICT → REVEAL cycle for a
// single Ruins case.
//
// Redesigned (v3) into a premium "case file" flow that matches the
// lantern-lit kingdom: deep indigo night, warm gold accents, frosted
// glass evidence cards, aged-paper message records. The three active
// verbs are now genuinely tactile — brush rubble away tile-by-tile
// (Excavate), wire witness testimony to the questions it answers
// (Interrogate), pin unsigned messages to the member who sent them
// (Reconstruct) — and the payoff is a weighty wax-seal stamp followed
// by a slot-by-slot graded reveal and the recovered real messages.
// Every ANSWER still comes pre-baked from worldGen.js; the verbs are
// presentation only. Calls onComplete({caseId, grade}) on return.
// ============================================================
import { useState, useRef } from 'react';

// ── Theme tokens (shared with RuinsCanvas) ─────────────────────
const NIGHT = 'linear-gradient(180deg, #171327 0%, #120E20 55%, #0A0813 100%)';
const GOLD = '#F4C77B';
const GOLD_BRIGHT = '#FFE7B0';
const INK = '#FBFAF6';
const INK_SOFT = 'rgba(251,250,246,0.66)';
const PAPER = '#FBF4E4';
const MINT = '#5BD6A0';
const ROSE = '#FF7B8A';

const AUTHOR_COLORS = ['#E0A93B', '#FF1867', '#00BFFF', '#43AA8B', '#FF8C00', '#FF69B4', '#f06449', '#9B7BE0'];
const GRADE = {
  gold:   { emoji: '🥇', ring: '#FFCB5E', glow: 'rgba(255,203,94,0.55)' },
  silver: { emoji: '🥈', ring: '#CFE0EA', glow: 'rgba(207,224,234,0.5)' },
  bronze: { emoji: '🥉', ring: '#D89A66', glow: 'rgba(216,154,102,0.45)' },
};
const BEAT_META = {
  excavate:    { icon: '⛏️', key: 'ruins_beat_excavate' },
  interrogate: { icon: '🗣️', key: 'ruins_beat_interrogate' },
  reconstruct: { icon: '🧩', key: 'ruins_beat_reconstruct' },
};
const BEAT_ORDER = ['excavate', 'interrogate', 'reconstruct'];

const card = {
  background: 'linear-gradient(180deg, rgba(46,38,66,0.6), rgba(28,22,44,0.6))',
  border: '1px solid rgba(244,199,123,0.16)',
  borderRadius: 18,
  boxShadow: '0 12px 30px -16px rgba(0,0,0,0.7)',
};
const paperBubbleStyle = {
  background: PAPER, color: '#241B10', borderRadius: '4px 16px 16px 16px',
  padding: '10px 13px', fontSize: 14.5, lineHeight: 1.4, maxWidth: '88%',
  boxShadow: '0 6px 16px -8px rgba(0,0,0,0.6)',
};

function excerptContent(e, t) {
  if (e.isVoice) return t.cg_voice || '🎙️ voice note';
  if (e.hasMedia) return t.cg_media || '🖼 media';
  return e.content;
}

// ── Atmosphere ─────────────────────────────────────────────────
function Atmosphere() {
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      <div className="a-wobble" style={{ position: 'absolute', top: '-12%', left: '-18%', width: 260, height: 260, borderRadius: '50%', background: GOLD, opacity: 0.1, filter: 'blur(70px)' }} />
      <div className="a-wobble" style={{ position: 'absolute', bottom: '-14%', right: '-12%', width: 300, height: 300, borderRadius: '50%', background: '#6A4DB0', opacity: 0.14, filter: 'blur(80px)' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(120% 80% at 50% 120%, rgba(4,3,9,0.5), transparent 60%)' }} />
    </div>
  );
}

function PrimaryButton({ children, ...rest }) {
  return (
    <button className="press" style={{
      alignSelf: 'stretch', minHeight: 54, border: 'none', borderRadius: 999, cursor: 'pointer',
      background: 'linear-gradient(180deg, #FFE7B0, #F4B45A)', color: '#3A2A12',
      fontFamily: 'inherit', fontWeight: 800, fontSize: 17,
      boxShadow: '0 7px 0 #B57D32, 0 18px 32px -10px rgba(244,180,90,0.6)',
    }} {...rest}>{children}</button>
  );
}

function Eyebrow({ children, color = GOLD }) {
  return (
    <div className="fs-mono" style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.22em', textTransform: 'uppercase', color }}>
      {children}
    </div>
  );
}

// Step rail shown across the three evidence beats.
function BeatRail({ beats, index, t }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {beats.map((b, i) => {
        const done = i < index, active = i === index;
        return (
          <div key={b} style={{ display: 'flex', alignItems: 'center', gap: 8, flex: i < beats.length - 1 ? 1 : 0 }}>
            <div style={{
              width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
              background: active ? 'linear-gradient(180deg,#FFE7B0,#F4B45A)' : done ? 'rgba(91,214,160,0.2)' : 'rgba(255,255,255,0.06)',
              border: active ? 'none' : done ? `1px solid ${MINT}` : '1px solid rgba(255,255,255,0.12)',
              boxShadow: active ? '0 4px 14px -4px rgba(244,180,90,0.7)' : 'none',
              transition: 'all 0.3s',
            }}>{done ? <span style={{ color: MINT, fontWeight: 900 }}>✓</span> : BEAT_META[b].icon}</div>
            {i < beats.length - 1 && (
              <div style={{ flex: 1, height: 2, borderRadius: 2, background: done ? MINT : 'rgba(255,255,255,0.1)', transition: 'background 0.3s' }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Excavate: brush rubble tiles away to expose the buried fact ──
function ExcavateBeat({ data, slot, t, onComplete }) {
  const COLS = 7, ROWS = 4, TOTAL = COLS * ROWS;
  const [brushed, setBrushed] = useState(() => new Set());
  const [revealed, setRevealed] = useState(false);
  const dragRef = useRef(false);
  const boxRef = useRef(null);

  function brushAt(clientX, clientY) {
    const el = boxRef.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const col = Math.floor(((clientX - r.left) / r.width) * COLS);
    const row = Math.floor(((clientY - r.top) / r.height) * ROWS);
    setBrushed(prev => {
      const next = new Set(prev);
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const c = col + dc, rr = row + dr;
        if (c >= 0 && c < COLS && rr >= 0 && rr < ROWS) next.add(rr * COLS + c);
      }
      if (!revealed && next.size / TOTAL >= 0.66) setRevealed(true);
      return next;
    });
  }
  function onDown(e) { dragRef.current = true; brushAt(e.clientX, e.clientY); }
  function onMove(e) { if (dragRef.current && !revealed) brushAt(e.clientX, e.clientY); }
  function onUp() { dragRef.current = false; }

  const pct = Math.min(100, Math.round((brushed.size / TOTAL) * 100));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ fontSize: 13.5, color: INK_SOFT, margin: 0 }}>{t.ruins_excavate_hint || 'Brush the rubble away to dig out the buried fact.'}</p>
        {!revealed && <span className="fs-mono" style={{ fontSize: 12, fontWeight: 800, color: GOLD }}>{pct}%</span>}
      </div>

      <div
        ref={boxRef}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onPointerLeave={onUp}
        style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', touchAction: 'none', minHeight: 132, cursor: 'grab', ...card }}
      >
        {/* Buried fact, exposed as tiles clear */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18 }}>
          <div className={revealed ? 'a-spring' : ''} style={{
            ...paperBubbleStyle, textAlign: 'center', maxWidth: '92%',
            border: revealed ? `2px solid ${GOLD}` : 'none',
          }}>
            {revealed ? data.revealText : data.fragmentText}
          </div>
        </div>
        {/* Rubble tiles */}
        {!revealed && (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: `repeat(${COLS},1fr)`, gridTemplateRows: `repeat(${ROWS},1fr)`, pointerEvents: 'none' }}>
            {Array.from({ length: TOTAL }).map((_, i) => (
              <div key={i} style={{
                background: 'linear-gradient(135deg, #4A3F55, #2C2438)',
                borderRight: '1px solid rgba(0,0,0,0.22)', borderBottom: '1px solid rgba(0,0,0,0.22)',
                opacity: brushed.has(i) ? 0 : 1,
                transform: brushed.has(i) ? 'scale(0.6)' : 'scale(1)',
                transition: 'opacity 0.25s, transform 0.25s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
              }}>{(i * 7) % 5 === 0 ? '·' : ''}</div>
            ))}
          </div>
        )}
      </div>

      {revealed && (
        <PrimaryButton onClick={() => onComplete({ [slot.id]: { label: slot.answerLabel, correct: true } })}>
          {t.ruins_continue || 'Continue'}
        </PrimaryButton>
      )}
    </div>
  );
}

// ── Interrogate: wire each testimony to the question it answers ──
function InterrogateBeat({ data, slots, t, onComplete }) {
  const relevantSlots = slots.filter(s => data.testimonies.some(te => te.slotId === s.id));
  const [selected, setSelected] = useState(null);
  const [pairs, setPairs] = useState({});
  const used = new Set(Object.values(pairs));

  function pickTestimony(i) {
    if (used.has(i)) return;
    setSelected(sel => (sel === i ? null : i));
  }
  function pickSlot(slotId) {
    if (pairs[slotId] != null) {
      setPairs(prev => { const next = { ...prev }; delete next[slotId]; return next; });
      return;
    }
    if (selected == null) return;
    setPairs(prev => ({ ...prev, [slotId]: selected }));
    setSelected(null);
  }

  const allAssigned = relevantSlots.every(s => pairs[s.id] != null);
  function handleContinue() {
    const answers = {};
    for (const s of relevantSlots) {
      const te = data.testimonies[pairs[s.id]];
      const teSlot = slots.find(x => x.id === te.slotId);
      answers[s.id] = { label: teSlot.answerLabel, correct: te.slotId === s.id };
    }
    onComplete(answers);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Witness */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, ...card }}>
        <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'linear-gradient(180deg,#FFE7B0,#E0A93B)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#2A1F0C', fontSize: 19, flexShrink: 0 }}>
          {data.npc.initial}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 800, color: INK, fontSize: 15 }}>{data.npc.author}</div>
          <div className="fs-mono" style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: INK_SOFT }}>{t.ruins_witness_tag || 'Witness'}</div>
        </div>
      </div>

      <p style={{ fontSize: 13.5, color: INK_SOFT, margin: 0 }}>
        <b style={{ color: GOLD }}>1.</b> {t.ruins_pair_pick_te || 'Pick a line of testimony'} &nbsp;·&nbsp; <b style={{ color: GOLD }}>2.</b> {t.ruins_pair_pick_slot || 'tap the question it answers'}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {data.testimonies.map((te, i) => {
          const isSel = selected === i, isUsed = used.has(i);
          return (
            <button key={i} onClick={() => pickTestimony(i)} disabled={isUsed} className="press"
              style={{
                ...paperBubbleStyle, maxWidth: '100%', textAlign: 'start', cursor: isUsed ? 'default' : 'pointer',
                border: isSel ? `2px solid ${GOLD}` : '2px solid transparent',
                opacity: isUsed ? 0.32 : 1,
                transform: isSel ? 'translateX(4px)' : 'none', transition: 'transform 0.2s, opacity 0.2s, border-color 0.2s',
                boxShadow: isSel ? `0 8px 22px -8px ${GOLD}` : paperBubbleStyle.boxShadow,
              }}>
              {te.text}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {relevantSlots.map(s => {
          const pairedIdx = pairs[s.id];
          const te = pairedIdx != null ? data.testimonies[pairedIdx] : null;
          const teSlot = te ? slots.find(x => x.id === te.slotId) : null;
          const filled = !!teSlot;
          return (
            <button key={s.id} onClick={() => pickSlot(s.id)} className="press"
              style={{
                ...card, textAlign: 'start', display: 'flex', flexDirection: 'column', gap: 4, padding: 14, cursor: 'pointer',
                border: filled ? `1.5px solid ${GOLD}` : selected != null ? '1.5px dashed rgba(244,199,123,0.55)' : '1px solid rgba(255,255,255,0.1)',
                color: INK,
              }}>
              <span className="fs-mono" style={{ fontSize: 11, letterSpacing: '0.04em', color: INK_SOFT }}>{s.label}</span>
              <span style={{ fontWeight: 700, color: filled ? GOLD_BRIGHT : 'rgba(251,250,246,0.4)' }}>
                {filled ? teSlot.answerLabel : (t.ruins_slot_empty || '— tap to place evidence —')}
              </span>
            </button>
          );
        })}
      </div>

      {allAssigned && <PrimaryButton onClick={handleContinue}>{t.ruins_continue || 'Continue'}</PrimaryButton>}
    </div>
  );
}

// ── Reconstruct: pin unsigned messages onto the member who sent them ──
function ReconstructBeat({ data, t, onComplete }) {
  const [selected, setSelected] = useState(null);
  const [pairs, setPairs] = useState({});
  const used = new Set(Object.values(pairs));

  function pickBubble(slotId) {
    if (pairs[slotId]) {
      setPairs(prev => { const next = { ...prev }; delete next[slotId]; return next; });
      return;
    }
    setSelected(sel => (sel === slotId ? null : slotId));
  }
  function pickMedallion(id) {
    if (used.has(id) || selected == null) return;
    setPairs(prev => ({ ...prev, [selected]: id }));
    setSelected(null);
  }

  const allAssigned = data.bubbles.every(b => pairs[b.slotId]);
  function handleContinue() {
    const answers = {};
    for (const b of data.bubbles) {
      const chosen = pairs[b.slotId];
      answers[b.slotId] = { label: chosen, correct: chosen === b.answer };
    }
    onComplete(answers);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <p style={{ fontSize: 13.5, color: INK_SOFT, margin: 0 }}>
        <b style={{ color: GOLD }}>1.</b> {t.ruins_recon_pick_msg || 'Tap an unsigned message'} &nbsp;·&nbsp; <b style={{ color: GOLD }}>2.</b> {t.ruins_recon_pick_who || 'tap who you think said it'}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {data.bubbles.map(b => {
          const assigned = pairs[b.slotId];
          const m = assigned ? data.medallions.find(x => x.id === assigned) : null;
          const isSel = selected === b.slotId;
          return (
            <div key={b.slotId} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div className={m ? 'a-pop-in' : ''} style={{
                width: 38, height: 38, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: 14, color: m ? '#1B1813' : 'rgba(251,250,246,0.5)',
                background: m ? m.color : 'rgba(255,255,255,0.08)',
                border: m ? '2px solid rgba(255,255,255,0.5)' : '2px dashed rgba(255,255,255,0.18)',
                boxShadow: m ? `0 6px 16px -6px ${m.color}` : 'none',
              }}>{m ? m.label : '?'}</div>
              <button onClick={() => pickBubble(b.slotId)} className="press"
                style={{
                  ...paperBubbleStyle, maxWidth: '100%', textAlign: 'start', cursor: 'pointer',
                  border: isSel ? `2px solid ${GOLD}` : '2px solid transparent',
                  transform: isSel ? 'translateX(4px)' : 'none', transition: 'transform 0.2s, border-color 0.2s',
                  boxShadow: isSel ? `0 8px 22px -8px ${GOLD}` : paperBubbleStyle.boxShadow,
                }}>
                {b.text}
              </button>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
        <span className="fs-mono" style={{ fontSize: 10.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: INK_SOFT }}>{t.ruins_suspects || 'Suspects'}</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
          {data.medallions.map(m => {
            const isUsed = used.has(m.id);
            return (
              <button key={m.id} onClick={() => pickMedallion(m.id)} disabled={isUsed} className="press"
                style={{
                  width: 52, height: 52, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.55)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 17,
                  color: '#1B1813', background: m.color, opacity: isUsed ? 0.28 : 1,
                  cursor: isUsed ? 'default' : 'pointer',
                  boxShadow: selected != null && !isUsed ? `0 0 0 3px rgba(244,199,123,0.4)` : `0 6px 16px -6px ${m.color}`,
                  transition: 'box-shadow 0.2s, opacity 0.2s',
                }}>{m.label}</button>
            );
          })}
        </div>
      </div>

      {allAssigned && <PrimaryButton onClick={handleContinue}>{t.ruins_continue || 'Continue'}</PrimaryButton>}
    </div>
  );
}

// ── Recovered records (the real messages) ──────────────────────
function RecordsReveal({ excerpts, t }) {
  const colorMap = new Map();
  let ci = 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
      {excerpts.map((e, i) => {
        if (!colorMap.has(e.author)) colorMap.set(e.author, AUTHOR_COLORS[ci++ % AUTHOR_COLORS.length]);
        const color = colorMap.get(e.author);
        return (
          <div key={i} className="a-fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-start', animationDelay: `${i * 70}ms` }}>
            <span className="fs-mono" style={{ fontSize: 10.5, fontWeight: 800, color, padding: '0 10px', letterSpacing: '0.04em' }}>{e.author}</span>
            <div style={{ ...paperBubbleStyle }}>{excerptContent(e, t)}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────
export default function CaseScene({ caseData, t, lang, isRTL = false, reducedMotion = false, onComplete }) {
  const [phase, setPhase] = useState('lead');
  const [beatIndex, setBeatIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [grade, setGrade] = useState(null);
  const [stamping, setStamping] = useState(false);

  const beats = BEAT_ORDER.filter(k => caseData.evidence[k]);

  function handleBeatComplete(partial) {
    const merged = { ...answers, ...partial };
    setAnswers(merged);
    if (beatIndex + 1 < beats.length) setBeatIndex(beatIndex + 1);
    else setPhase('verdict');
  }

  function handleStamp() {
    const total = caseData.slots.length;
    const correct = caseData.slots.filter(s => answers[s.id]?.correct).length;
    const pct = total > 0 ? correct / total : 0;
    const g = pct >= 1 ? 'gold' : pct >= 0.5 ? 'silver' : 'bronze';
    setGrade(g);
    setStamping(true);
    setTimeout(() => { setStamping(false); setPhase('reveal'); }, reducedMotion ? 0 : 620);
  }

  const gMeta = grade ? GRADE[grade] : null;

  return (
    <div className="fs-sans no-sb" dir={isRTL ? 'rtl' : 'ltr'} style={{
      position: 'absolute', inset: 0, background: NIGHT, color: INK,
      overflowY: 'auto', display: 'flex', flexDirection: 'column',
    }}>
      <style>{`
        @keyframes wax { 0% { transform: scale(2.4) rotate(-14deg); opacity: 0; } 55% { transform: scale(0.86) rotate(-6deg); opacity: 1; } 75% { transform: scale(1.08) rotate(-8deg); } 100% { transform: scale(1) rotate(-7deg); opacity: 1; } }
        .wax-stamp { animation: wax 0.6s cubic-bezier(0.34,1.56,0.64,1) both; }
        @keyframes flipIn { 0% { transform: perspective(500px) rotateX(-90deg); opacity: 0; } 100% { transform: perspective(500px) rotateX(0); opacity: 1; } }
        .flip-in { animation: flipIn 0.5s cubic-bezier(0.16,1,0.3,1) both; }
      `}</style>
      <Atmosphere />

      <div style={{ position: 'relative', zIndex: 1, padding: 'calc(env(safe-area-inset-top,0px) + 60px) 20px calc(env(safe-area-inset-bottom,0px) + 28px)', display: 'flex', flexDirection: 'column', gap: 18, flex: 1 }}>

        {/* ── LEAD — the case file cover ───────────────────────── */}
        {phase === 'lead' && (
          <div className="a-fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 18, flex: 1, justifyContent: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <div style={{ position: 'relative' }}>
                <div aria-hidden style={{ position: 'absolute', inset: -14, borderRadius: '50%', background: 'radial-gradient(circle, rgba(244,199,123,0.3), transparent 70%)' }} />
                <div className="a-pop-in" style={{
                  position: 'relative', width: 88, height: 88, borderRadius: '50%', fontSize: 40,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'radial-gradient(circle at 38% 30%, #2C2440, #15111F)',
                  border: `2px solid rgba(244,199,123,0.5)`, boxShadow: '0 0 40px -6px rgba(244,199,123,0.4)',
                }}>{caseData.emoji}</div>
              </div>
              <Eyebrow>{t.ruins_case_file || 'Case File'}</Eyebrow>
              <h1 className="fs-display" style={{ fontSize: 27, fontWeight: 800, textAlign: 'center', margin: 0, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{caseData.title}</h1>
              <p className="fs-serif" style={{ fontSize: 17, lineHeight: 1.55, textAlign: 'center', color: 'rgba(251,250,246,0.8)', margin: 0, maxWidth: 320, fontStyle: 'italic' }}>{caseData.lead}</p>
            </div>

            {/* Open verdict slots — the itch */}
            <div style={{ ...card, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Eyebrow color={INK_SOFT}>{t.ruins_to_uncover || 'To uncover'}</Eyebrow>
              {caseData.slots.map(s => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: GOLD, flexShrink: 0, boxShadow: `0 0 8px ${GOLD}` }} />
                  <span style={{ fontSize: 14.5, color: INK, fontWeight: 600 }}>{s.label}</span>
                </div>
              ))}
            </div>

            <PrimaryButton onClick={() => setPhase('evidence')}>{t.ruins_begin || 'Begin investigation'}</PrimaryButton>
          </div>
        )}

        {/* ── EVIDENCE — the active verbs ──────────────────────── */}
        {phase === 'evidence' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <BeatRail beats={beats} index={beatIndex} t={t} />
              <div>
                <Eyebrow>{(t[BEAT_META[beats[beatIndex]].key]) || beats[beatIndex]}</Eyebrow>
                <h2 className="fs-display" style={{ fontSize: 20, fontWeight: 800, margin: '4px 0 0' }}>{caseData.title}</h2>
              </div>
            </div>
            <div className="a-fade-up" key={beatIndex}>
              {beats[beatIndex] === 'excavate' && (
                <ExcavateBeat data={caseData.evidence.excavate} slot={caseData.slots.find(s => s.id === caseData.evidence.excavate.slotId)} t={t} onComplete={handleBeatComplete} />
              )}
              {beats[beatIndex] === 'interrogate' && (
                <InterrogateBeat data={caseData.evidence.interrogate} slots={caseData.slots} t={t} onComplete={handleBeatComplete} />
              )}
              {beats[beatIndex] === 'reconstruct' && (
                <ReconstructBeat data={caseData.evidence.reconstruct} t={t} onComplete={handleBeatComplete} />
              )}
            </div>
          </div>
        )}

        {/* ── VERDICT — commit, then stamp ─────────────────────── */}
        {phase === 'verdict' && (
          <div className="a-fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
            <div>
              <Eyebrow>{t.ruins_verdict_eyebrow || 'The verdict board'}</Eyebrow>
              <h2 className="fs-display" style={{ fontSize: 22, fontWeight: 800, margin: '4px 0 0' }}>{t.ruins_verdict_title || 'Commit your findings'}</h2>
              <p style={{ fontSize: 13.5, color: INK_SOFT, margin: '6px 0 0' }}>{t.ruins_verdict_hint || 'Once stamped, the record is final.'}</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
              {caseData.slots.map(s => (
                <div key={s.id} style={{ ...card, padding: 16 }}>
                  <div className="fs-mono" style={{ fontSize: 11, color: INK_SOFT, letterSpacing: '0.04em' }}>{s.label}</div>
                  <div style={{ fontWeight: 800, marginTop: 5, fontSize: 16, color: GOLD_BRIGHT }}>{answers[s.id]?.label}</div>
                </div>
              ))}
            </div>
            <div style={{ position: 'relative' }}>
              <PrimaryButton onClick={handleStamp} disabled={stamping}>{t.ruins_stamp || 'Stamp the verdict'}</PrimaryButton>
              {stamping && (
                <div aria-hidden className="wax-stamp" style={{
                  position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 64, pointerEvents: 'none',
                }}>🔴</div>
              )}
            </div>
          </div>
        )}

        {/* ── REVEAL — graded, then the recovered truth ────────── */}
        {phase === 'reveal' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Seal */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <div style={{ position: 'relative', width: 108, height: 108, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div aria-hidden style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: `radial-gradient(circle, ${gMeta.glow}, transparent 70%)` }} />
                <div className="a-spring" style={{
                  position: 'relative', width: 92, height: 92, borderRadius: '50%', fontSize: 46,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'radial-gradient(circle at 38% 30%, #2C2440, #15111F)',
                  border: `3px solid ${gMeta.ring}`, boxShadow: `0 0 36px -4px ${gMeta.glow}`,
                }}>{gMeta.emoji}</div>
              </div>
              <div className="fs-display a-fade-up" style={{ fontSize: 24, fontWeight: 800 }}>{t[`ruins_grade_${grade}`] || grade}</div>
              <div className="fs-mono a-fade-up" style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: INK_SOFT, animationDelay: '0.08s' }}>
                {t.ruins_seal_label || 'Seal earned'}
              </div>
            </div>

            {/* Slot results */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {caseData.slots.map((s, i) => {
                const a = answers[s.id];
                const ok = a?.correct;
                return (
                  <div key={s.id} className="flip-in" style={{
                    ...card, padding: 14, animationDelay: `${250 + i * 160}ms`,
                    borderColor: ok ? 'rgba(91,214,160,0.4)' : 'rgba(255,123,138,0.4)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <div className="fs-mono" style={{ fontSize: 10.5, color: INK_SOFT }}>{s.label}</div>
                        <div style={{ fontWeight: 800, marginTop: 3, fontSize: 15.5, color: ok ? INK : 'rgba(251,250,246,0.55)' }}>{a?.label}</div>
                      </div>
                      <span style={{ fontSize: 20, color: ok ? MINT : ROSE, flexShrink: 0, fontWeight: 900 }}>{ok ? '✓' : '✕'}</span>
                    </div>
                    {!ok && (
                      <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.08)', fontSize: 13 }}>
                        <span className="fs-mono" style={{ color: INK_SOFT, fontSize: 11 }}>{t.ruins_truth_was || 'The truth:'} </span>
                        <span style={{ color: GOLD_BRIGHT, fontWeight: 700 }}>{s.answerLabel}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Recovered records */}
            <div style={{ ...card, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <Eyebrow>{t.ruins_what_happened || 'What really happened'}</Eyebrow>
                {caseData.reveal.meta.filter(Boolean).length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                    {caseData.reveal.meta.filter(Boolean).map((m, i) => (
                      <span key={i} className="fs-mono" style={{ padding: '4px 10px', borderRadius: 999, background: 'rgba(244,199,123,0.12)', border: '1px solid rgba(244,199,123,0.22)', fontSize: 10.5, fontWeight: 700, color: GOLD_BRIGHT }}>{m}</span>
                    ))}
                  </div>
                )}
              </div>
              <RecordsReveal excerpts={caseData.reveal.excerpts} t={t} />
            </div>

            {/* New leads */}
            {caseData.leadsAfter?.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Eyebrow>{t.ruins_new_leads || 'New leads'}</Eyebrow>
                {caseData.leadsAfter.map((l, i) => (
                  <div key={i} style={{ display: 'flex', gap: 11, alignItems: 'flex-start', padding: 14, ...card, borderColor: 'rgba(244,199,123,0.25)' }}>
                    <span aria-hidden style={{ fontSize: 17, flexShrink: 0 }}>🔎</span>
                    <p className="fs-serif" style={{ fontSize: 15, lineHeight: 1.5, color: 'rgba(251,250,246,0.86)', margin: 0, fontStyle: 'italic' }}>{l}</p>
                  </div>
                ))}
              </div>
            )}

            <PrimaryButton onClick={() => onComplete({ caseId: caseData.id, grade })}>{t.ruins_return_kingdom || 'Return to the kingdom'}</PrimaryButton>
          </div>
        )}
      </div>
    </div>
  );
}
