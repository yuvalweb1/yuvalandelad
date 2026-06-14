// ============================================================
// CaseScene — the LEAD -> EVIDENCE -> VERDICT -> REVEAL cycle for
// a single Ruins case. DOM-based (mirrors ChaosTimeline's scenes),
// reusing GlobalStyles animation classes. Verb beats (Excavate /
// Interrogate / Reconstruct) are presentational only — every slot's
// ANSWER comes pre-baked from worldGen.js. Calls onComplete({caseId,
// grade}) once the player returns to the kingdom.
// ============================================================
import { useState, useRef } from 'react';

const AUTHOR_COLORS = ['#FFD700', '#FF1867', '#00BFFF', '#43AA8B', '#FF8C00', '#FF69B4', '#f06449', '#573280'];
const GRADE_EMOJI = { gold: '🥇', silver: '🥈', bronze: '🥉' };
const BEAT_ORDER = ['excavate', 'interrogate', 'reconstruct'];

function excerptContent(e, t) {
  if (e.isVoice) return t.cg_voice || '🎙️ voice note';
  if (e.hasMedia) return t.cg_media || '🖼 media';
  return e.content;
}

function FloatingBlobs() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      <div className="a-wobble" style={{ position: 'absolute', top: '-10%', left: '-15%', width: 220, height: 220, borderRadius: '50%', background: '#f9c74f', opacity: 0.12, filter: 'blur(60px)' }} />
      <div className="a-wobble" style={{ position: 'absolute', bottom: '-10%', right: '-10%', width: 260, height: 260, borderRadius: '50%', background: '#f9c74f', opacity: 0.08, filter: 'blur(70px)' }} />
    </div>
  );
}

function EvidenceList({ excerpts, t }) {
  const colorMap = new Map();
  let ci = 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {excerpts.map((e, i) => {
        if (!colorMap.has(e.author)) colorMap.set(e.author, AUTHOR_COLORS[ci++ % AUTHOR_COLORS.length]);
        const color = colorMap.get(e.author);
        return (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color, padding: '0 10px' }}>{e.author}</span>
            <div style={{ background: '#FBFAF6', color: '#1B1813', borderRadius: 14, padding: '8px 12px', fontSize: 14, maxWidth: '85%', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
              {excerptContent(e, t)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const card = { background: 'rgba(251,250,246,0.07)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 16 };
const ghostBubble = { background: 'rgba(251,250,246,0.95)', color: '#1B1813', borderRadius: 14, padding: '10px 14px', fontSize: 14, maxWidth: '85%' };

function PrimaryButton({ children, ...rest }) {
  return <button className="pop-btn a-pop-in press" style={{ alignSelf: 'center', minHeight: 44 }} {...rest}>{children}</button>;
}

// ── Excavate: drag to clear rubble, revealing one fact ──────
function ExcavateBeat({ data, slot, t, onComplete }) {
  const [coverage, setCoverage] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const dragRef = useRef(false);
  const lastRef = useRef(null);

  function onDown(e) { dragRef.current = true; lastRef.current = { x: e.clientX, y: e.clientY }; }
  function onMove(e) {
    if (!dragRef.current || revealed) return;
    const last = lastRef.current;
    if (last) {
      const d = Math.hypot(e.clientX - last.x, e.clientY - last.y);
      setCoverage(c => {
        const next = Math.min(100, c + d * 0.5);
        if (next >= 100) setRevealed(true);
        return next;
      });
    }
    lastRef.current = { x: e.clientX, y: e.clientY };
  }
  function onUp() { dragRef.current = false; lastRef.current = null; }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p style={{ fontSize: 14, opacity: 0.85, margin: 0 }}>{t.ruins_excavate_hint || 'Drag across the rubble to dig it out.'}</p>
      <div
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', touchAction: 'none', minHeight: 96 }}
      >
        <div style={ghostBubble}>{revealed ? data.revealText : data.fragmentText}</div>
        {!revealed && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#5b4a3a', opacity: 1 - coverage / 100, fontSize: 28, transition: 'opacity 0.08s linear',
          }}>
            🪨
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

// ── Interrogate: tap-to-pair testimony lines onto verdict slots ──
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#f9c74f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#1B1813', fontSize: 18, flexShrink: 0 }}>
          {data.npc.initial}
        </div>
        <div style={{ fontWeight: 700 }}>{data.npc.author}</div>
      </div>
      <p style={{ fontSize: 13, opacity: 0.8, margin: 0 }}>{t.ruins_pair_hint || 'Tap a piece of testimony, then tap the question it answers.'}</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data.testimonies.map((te, i) => (
          <button
            key={i}
            onClick={() => pickTestimony(i)}
            disabled={used.has(i)}
            className="press"
            style={{
              ...ghostBubble, textAlign: 'start', border: selected === i ? '2px solid #f9c74f' : '2px solid transparent',
              opacity: used.has(i) ? 0.35 : 1, cursor: used.has(i) ? 'default' : 'pointer',
            }}
          >
            {te.text}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {relevantSlots.map(s => {
          const pairedIdx = pairs[s.id];
          const te = pairedIdx != null ? data.testimonies[pairedIdx] : null;
          const teSlot = te ? slots.find(x => x.id === te.slotId) : null;
          return (
            <button
              key={s.id} onClick={() => pickSlot(s.id)} className="press"
              style={{ ...card, textAlign: 'start', display: 'flex', flexDirection: 'column', gap: 4, border: '2px solid ' + (te ? '#f9c74f' : 'rgba(255,255,255,0.08)'), color: '#FBFAF6' }}
            >
              <span style={{ fontSize: 12, opacity: 0.7 }}>{s.label}</span>
              <span style={{ fontWeight: 700 }}>{teSlot ? teSlot.answerLabel : (t.ruins_slot_empty || '— place evidence here —')}</span>
            </button>
          );
        })}
      </div>

      {allAssigned && <PrimaryButton onClick={handleContinue}>{t.ruins_continue || 'Continue'}</PrimaryButton>}
    </div>
  );
}

// ── Reconstruct: tap-to-pair ghost bubbles onto member medallions ──
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p style={{ fontSize: 13, opacity: 0.8, margin: 0 }}>{t.ruins_pair_hint_recon || 'Tap a message, then tap who you think said it.'}</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {data.bubbles.map(b => {
          const assigned = pairs[b.slotId];
          const m = assigned ? data.medallions.find(x => x.id === assigned) : null;
          return (
            <div key={b.slotId} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: 13, color: '#1B1813', background: m ? m.color : 'rgba(255,255,255,0.18)',
              }}>
                {m ? m.label : '?'}
              </div>
              <button
                onClick={() => pickBubble(b.slotId)} className="press"
                style={{ ...ghostBubble, textAlign: 'start', border: selected === b.slotId ? '2px solid #f9c74f' : '2px solid transparent' }}
              >
                {b.text}
              </button>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
        {data.medallions.map(m => (
          <button
            key={m.id} onClick={() => pickMedallion(m.id)} disabled={used.has(m.id)} className="press"
            style={{
              width: 44, height: 44, borderRadius: '50%', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: 16, color: '#1B1813', background: m.color, opacity: used.has(m.id) ? 0.3 : 1,
              cursor: used.has(m.id) ? 'default' : 'pointer',
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      {allAssigned && <PrimaryButton onClick={handleContinue}>{t.ruins_continue || 'Continue'}</PrimaryButton>}
    </div>
  );
}

export default function CaseScene({ caseData, t, lang, isRTL = false, reducedMotion = false, onComplete }) {
  const [phase, setPhase] = useState('lead');
  const [beatIndex, setBeatIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [grade, setGrade] = useState(null);

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
    setGrade(pct >= 1 ? 'gold' : pct >= 0.5 ? 'silver' : 'bronze');
    setPhase('reveal');
  }

  return (
    <div className="fs-sans" dir={isRTL ? 'rtl' : 'ltr'} style={{
      position: 'absolute', inset: 0, background: 'linear-gradient(180deg, #1B1813, #2a2118)', color: '#FBFAF6',
      overflowY: 'auto', display: 'flex', flexDirection: 'column',
    }}>
      <FloatingBlobs />
      <div style={{ position: 'relative', zIndex: 1, padding: '64px 20px 32px', display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
        {phase === 'lead' && (
          <div className="a-fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1, justifyContent: 'center' }}>
            <div style={{ fontSize: 36, textAlign: 'center' }}>{caseData.emoji}</div>
            <h1 className="fs-display" style={{ fontSize: 24, fontWeight: 800, textAlign: 'center', margin: 0 }}>{caseData.title}</h1>
            <p style={{ fontSize: 15, lineHeight: 1.6, textAlign: 'center', opacity: 0.85, margin: 0 }}>{caseData.lead}</p>
            <PrimaryButton onClick={() => setPhase('evidence')}>{t.ruins_begin || 'Begin'}</PrimaryButton>
          </div>
        )}

        {phase === 'evidence' && (
          <div className="a-fade-up" key={beatIndex} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h2 className="fs-display" style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>{caseData.title}</h2>
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
        )}

        {phase === 'verdict' && (
          <div className="a-fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h2 className="fs-display" style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>{t.ruins_verdict_title || 'The Verdict Board'}</h2>
            <p style={{ fontSize: 13, opacity: 0.8, margin: 0 }}>{t.ruins_verdict_hint || 'Once stamped, the record is final.'}</p>
            {caseData.slots.map(s => (
              <div key={s.id} style={card}>
                <div style={{ fontSize: 12, opacity: 0.7 }}>{s.label}</div>
                <div style={{ fontWeight: 700, marginTop: 4 }}>{answers[s.id]?.label}</div>
              </div>
            ))}
            <PrimaryButton onClick={handleStamp}>{t.ruins_stamp || 'Stamp the verdict'}</PrimaryButton>
          </div>
        )}

        {phase === 'reveal' && (
          <div className="a-fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div className="a-spring" style={{ fontSize: 48 }}>{GRADE_EMOJI[grade]}</div>
              <div style={{ fontWeight: 800, fontSize: 18 }}>{t[`ruins_grade_${grade}`] || grade}</div>
            </div>

            {caseData.slots.map((s, i) => {
              const a = answers[s.id];
              return (
                <div key={s.id} className="a-pop-in" style={{ ...card, animationDelay: `${i * 120}ms`, animationFillMode: 'both' }}>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>{s.label}</div>
                  <div style={{ fontWeight: 700, marginTop: 4 }}>{a?.correct ? '✓' : '✗'} {a?.label}</div>
                  {!a?.correct && (
                    <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>{t.ruins_truth_was || 'The truth:'} {s.answerLabel}</div>
                  )}
                </div>
              );
            })}

            <h3 className="fs-display" style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>{t.ruins_what_happened || 'What really happened'}</h3>
            <div style={{ fontSize: 12, opacity: 0.65 }}>{caseData.reveal.meta.filter(Boolean).join(' · ')}</div>
            <EvidenceList excerpts={caseData.reveal.excerpts} t={t} />

            {caseData.leadsAfter?.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <h3 className="fs-display" style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>{t.ruins_new_leads || 'New leads'}</h3>
                {caseData.leadsAfter.map((l, i) => (
                  <p key={i} style={{ fontSize: 14, lineHeight: 1.6, opacity: 0.85, margin: 0 }}>{l}</p>
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
