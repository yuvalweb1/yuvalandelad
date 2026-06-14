// ============================================================
// GuessWho — "Who said this?"
//
// A fast trivia game built from the deterministic
// `analytics.guessWho` quote pool. Each round shows a REAL message
// from the chat and asks which group member sent it. Tap a name →
// the answer is revealed instantly, with a little fun-fact about the
// real sender (their signature word/emoji), points, and streak combos.
// It climaxes in a "Detective IQ" score you can replay or share.
//
// Pure + deterministic: rounds, decoys and option order all come from
// a seeded shuffle keyed off the quote text — no Math.random /
// Date.now. Same chat → same game.
// ============================================================
import { useMemo, useRef, useState, useEffect } from 'react';

// ── Palette (shared with the other game modes) ─────────────────
const CREAM    = '#FFF6D6';
const PINK     = '#FDE6F1';
const EGGPLANT = '#4A0E4E';
const PLUM     = '#2a0645';
const CORAL    = '#f06449';
const GOLD     = '#FFD700';
const SKY      = '#00BFFF';
const MAGENTA  = '#FF1867';
const MINT     = '#43AA8B';
const ROSE     = '#F94144';
const MUTED    = 'rgba(74,14,78,0.55)';

// Cinematic dark canvas — a cool detective tilt vs. Chaos' hot pink.
const GAME_BG = `
  radial-gradient(120% 80% at 50% -5%, rgba(0,191,255,0.28) 0%, transparent 55%),
  radial-gradient(100% 80% at 0% 105%, rgba(87,50,128,0.55) 0%, transparent 60%),
  radial-gradient(90% 70% at 100% 100%, rgba(255,24,103,0.18) 0%, transparent 55%),
  linear-gradient(180deg, #161a3a 0%, #2a0645 58%, #0A192F 100%)`;

// Author bubble colours (deterministic by appearance order).
const AUTHOR_COLORS = [GOLD, MAGENTA, SKY, MINT, '#FF8C00', '#FF69B4', CORAL, '#573280'];

// ── Pure helpers ───────────────────────────────────────────────
function fill(str, vars) {
  return String(str ?? '').replace(/\{(\w+)\}/g, (_, k) => (vars && k in vars ? vars[k] : `{${k}}`));
}
function seedFromStr(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function seededShuffle(arr, seed) {
  const a = arr.slice();
  let s = (seed >>> 0) || 1;
  const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
// Short initials avatar for an author (first letters of up to 2 words).
function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2);
  return (parts[0][0] || '') + (parts[1][0] || '');
}

// A one-line "fun fact" about the real sender — ties the reveal back
// to the analytics the rest of the app already computed.
function revealFact(u, t) {
  if (!u) return '';
  if (u.topWord && u.topWordCount >= 5) return fill(t.gw_fact_word, { word: u.topWord, n: u.topWordCount.toLocaleString() });
  if (u.topEmoji) return fill(t.gw_fact_emoji, { emoji: u.topEmoji });
  if (u.messageCount) return fill(t.gw_fact_msgs, { n: u.messageCount.toLocaleString() });
  return '';
}

// ── Round builder ──────────────────────────────────────────────
// Turns the quote pool into an ordered, even-coverage set of rounds.
function buildRounds(gw, userMap, t) {
  if (!gw || !gw.quotes?.length) return [];
  const authors = (gw.authors || []).filter(Boolean);
  if (authors.length < 2) return [];
  const optionCount = Math.min(4, authors.length);

  // Best-first quotes grouped by author (pool is already sorted).
  const byAuthor = new Map();
  for (const q of gw.quotes) {
    if (!byAuthor.has(q.author)) byAuthor.set(q.author, []);
    byAuthor.get(q.author).push(q.content);
  }

  // Round-robin across authors so no one dominates and coverage is even.
  const queues = authors.map(a => ({ author: a, items: (byAuthor.get(a) || []).slice() }));
  const MAX_ROUNDS = 10;
  const picked = [];
  let progressed = true;
  while (picked.length < MAX_ROUNDS && progressed) {
    progressed = false;
    for (const q of queues) {
      if (q.items.length && picked.length < MAX_ROUNDS) {
        picked.push({ author: q.author, content: q.items.shift() });
        progressed = true;
      }
    }
  }
  if (picked.length < 3) return [];

  return picked.map((p, i) => {
    const seed = seedFromStr(p.content + '|' + i);
    const decoys = seededShuffle(authors.filter(a => a !== p.author), seed).slice(0, optionCount - 1);
    const options = seededShuffle([p.author, ...decoys], (seed ^ 0x9e3779b9) >>> 0);
    return { content: p.content, correct: p.author, options, fact: revealFact(userMap?.[p.author], t) };
  });
}

// ── Scoring ────────────────────────────────────────────────────
const BASE = 1000;
function gradeFor(t, iq) {
  if (iq >= 90) return { title: t.gw_grade_5_title, sub: t.gw_grade_5_sub, color: GOLD };
  if (iq >= 70) return { title: t.gw_grade_4_title, sub: t.gw_grade_4_sub, color: MAGENTA };
  if (iq >= 50) return { title: t.gw_grade_3_title, sub: t.gw_grade_3_sub, color: SKY };
  if (iq >= 25) return { title: t.gw_grade_2_title, sub: t.gw_grade_2_sub, color: CORAL };
  return { title: t.gw_grade_1_title, sub: t.gw_grade_1_sub, color: ROSE };
}

// ── Shared chrome ──────────────────────────────────────────────
function FloatingBlobs({ tint, op = 0.4 }) {
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', top: -90, left: -80, width: 280, height: 280, borderRadius: '50%', background: tint, opacity: op, filter: 'blur(86px)' }} />
      <div style={{ position: 'absolute', top: 220, right: -90, width: 240, height: 240, borderRadius: '50%', background: tint, opacity: op * 0.6, filter: 'blur(80px)' }} />
      <div style={{ position: 'absolute', bottom: -80, left: -60, width: 280, height: 280, borderRadius: '50%', background: tint, opacity: op * 0.75, filter: 'blur(80px)' }} />
    </div>
  );
}

// The quote on trial — a big WhatsApp-flavoured bubble with the
// sender's name redacted to a "?" so it's purely a guess.
function QuoteCard({ content }) {
  return (
    <div dir="auto" className="a-pop-in" style={{
      position: 'relative',
      background: 'rgba(255,255,255,0.1)',
      backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
      border: '1px solid rgba(255,255,255,0.2)',
      borderInlineStart: `4px solid ${GOLD}`,
      borderRadius: 20, padding: '18px 18px 20px',
      boxShadow: '0 24px 50px -22px rgba(0,0,0,0.65)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
        <div aria-hidden style={{
          width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
          background: 'rgba(255,255,255,0.14)', border: '1.5px dashed rgba(255,255,255,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 15, fontWeight: 800, color: 'rgba(255,255,255,0.7)',
        }}>?</div>
        <div className="fs-mono" style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.55)' }}>
          ••••••••
        </div>
      </div>
      <div className="fs-sans" style={{ fontSize: 'clamp(19px, 5.2vw, 24px)', fontWeight: 600, lineHeight: 1.36, color: '#fff' }}>
        {content}
      </div>
    </div>
  );
}

// The name options — one card per candidate sender.
function NameOptions({ options, picked, correct, reveal, colorFor, onPick }) {
  const twoCol = options.length > 2;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: twoCol ? '1fr 1fr' : '1fr', gap: 10 }}>
      {options.map((name) => {
        const selected = picked === name;
        const isCorrect = reveal && name === correct;
        const isWrongPick = reveal && selected && name !== correct;
        const c = colorFor(name);
        let border = '1.5px solid rgba(255,255,255,0.18)';
        let bg = 'rgba(255,255,255,0.07)';
        let glow = '0 8px 20px -14px rgba(0,0,0,0.6)';
        if (selected && !reveal) { border = `2px solid ${SKY}`; bg = 'rgba(255,255,255,0.14)'; glow = `0 10px 26px -10px ${SKY}`; }
        if (isCorrect) { border = `2px solid ${MINT}`; bg = `${MINT}26`; glow = `0 10px 28px -8px ${MINT}99`; }
        if (isWrongPick) { border = `2px solid ${ROSE}`; bg = `${ROSE}22`; glow = 'none'; }
        return (
          <button
            key={name} type="button" dir="auto"
            onClick={() => !reveal && onPick(name)}
            disabled={reveal}
            aria-pressed={!reveal ? selected : undefined}
            className={reveal ? '' : 'press'}
            style={{
              position: 'relative', textAlign: 'start', cursor: reveal ? 'default' : 'pointer',
              padding: '13px 14px', borderRadius: 16, border, background: bg,
              backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', boxShadow: glow,
              color: '#fff', fontFamily: 'inherit', minHeight: 58,
              display: 'flex', alignItems: 'center', gap: 11,
              transition: 'background 0.2s, border-color 0.2s, box-shadow 0.2s',
            }}>
            <div aria-hidden style={{
              width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
              background: reveal && !isCorrect && !isWrongPick ? 'rgba(255,255,255,0.12)' : `${c}2e`,
              border: `1.5px solid ${reveal && !isCorrect && !isWrongPick ? 'rgba(255,255,255,0.2)' : c}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12.5, fontWeight: 800, color: c, textTransform: 'uppercase',
            }}>{initials(name)}</div>
            <span className="fs-sans" style={{ flex: 1, minWidth: 0, fontSize: 15.5, fontWeight: 700, lineHeight: 1.15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
            {(isCorrect || isWrongPick) && (
              <span aria-hidden style={{ fontSize: 17, flexShrink: 0 }}>{isCorrect ? '✓' : '✕'}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Title / cold open ──────────────────────────────────────────
function TitleScene({ t, rounds, people, onStart }) {
  const MARKS = ['"', '?', '“', '”', '?', '"'];
  const pos = [
    { top: '9%', left: '9%' }, { top: '14%', right: '11%' },
    { top: '32%', right: '8%' }, { bottom: '30%', left: '8%' },
    { bottom: '19%', right: '13%' }, { top: '45%', left: '46%' },
  ];
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: GAME_BG, color: '#fff',
      display: 'flex', flexDirection: 'column',
      padding: 'calc(env(safe-area-inset-top, 0px) + 64px) 26px calc(env(safe-area-inset-bottom, 0px) + 28px)' }}>
      <FloatingBlobs tint={SKY} />
      {MARKS.map((e, i) => (
        <div key={i} className="a-float fs-display" aria-hidden style={{ position: 'absolute', ...pos[i], fontSize: 44, fontWeight: 800, color: 'rgba(255,255,255,0.16)', animationDelay: `${(i * 0.2) % 1.4}s` }}>{e}</div>
      ))}
      <div style={{ position: 'relative', zIndex: 2, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div className="fs-mono a-fade-up" style={{ fontSize: 13, letterSpacing: '0.28em', textTransform: 'uppercase', color: SKY, fontWeight: 800 }}>
          {t.gw_title_eyebrow || '🕵️ WHO SAID THIS?'}
        </div>
        <div className="fs-display a-fade-up" style={{
          marginTop: 14, fontSize: 'clamp(42px, 12vw, 64px)', fontWeight: 800, fontStyle: 'italic',
          letterSpacing: '-0.045em', lineHeight: 0.96,
          backgroundImage: `linear-gradient(135deg, #fff 0%, ${SKY} 45%, ${MAGENTA} 100%)`,
          WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', WebkitTextFillColor: 'transparent',
          filter: `drop-shadow(0 8px 24px ${SKY}55)`, animationDelay: '0.08s',
        }}>{t.gw_title_h1 || 'Do you know who really said it?'}</div>
        <div className="fs-sans a-fade-up" style={{ marginTop: 20, fontSize: 16, lineHeight: 1.5, color: 'rgba(255,255,255,0.78)', fontWeight: 500, maxWidth: 340, animationDelay: '0.2s' }}>
          {t.gw_title_sub || 'Real messages, no names. Guess who fired each one off, build streaks, and prove you actually read the chat.'}
        </div>
        <div className="fs-mono a-fade-up" style={{ marginTop: 18, fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.5)', animationDelay: '0.3s' }}>
          {fill(t.gw_title_meta || '{n} quotes · {people} suspects', { n: rounds, people })}
        </div>
      </div>
      <button onClick={onStart} className="press a-fade-up" style={{
        position: 'relative', zIndex: 2, width: '100%', padding: '18px 24px', borderRadius: 999, border: 'none', cursor: 'pointer',
        background: `linear-gradient(135deg, ${SKY}, ${MAGENTA} 80%)`, color: '#fff',
        fontWeight: 800, fontSize: 18, fontFamily: 'inherit',
        boxShadow: `0 12px 30px -8px ${MAGENTA}88, 0 2px 0 rgba(255,255,255,0.4) inset`, animationDelay: '0.42s',
      }}>{t.gw_title_cta || 'Start guessing'}</button>
    </div>
  );
}

// ── Question scene ─────────────────────────────────────────────
function QuestionScene({ round, t, picked, reveal, roundNum, roundTotal, score, streak, lastGain, colorFor, onPick, onContinue, bodyRef }) {
  const right = reveal && picked === round.correct;
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: GAME_BG, color: '#fff', display: 'flex', flexDirection: 'column' }}>
      <FloatingBlobs tint={reveal ? (right ? MINT : ROSE) : SKY} op={0.34} />

      {/* HUD */}
      <div style={{ position: 'relative', zIndex: 3, padding: 'calc(env(safe-area-inset-top, 0px) + 14px) 18px 0' }}>
        <div style={{ display: 'flex', gap: 4, marginBottom: 12, paddingInlineEnd: 44 }}>
          {Array.from({ length: roundTotal }).map((_, i) => (
            <div key={i} style={{ flex: 1, height: 3, borderRadius: 8, background: i < roundNum - 1 ? 'rgba(255,255,255,0.6)' : i === roundNum - 1 ? SKY : 'rgba(255,255,255,0.16)', transition: 'background 0.3s' }} />
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingInlineEnd: 44 }}>
          <span className="fs-mono" style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase' }}>
            {fill(t.cg_round_of || 'Round {n}/{total}', { n: roundNum, total: roundTotal })}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {streak >= 2 && (
              <span className="fs-mono a-pop-in" style={{ fontSize: 12, fontWeight: 800, color: GOLD }}>🔥 ×{streak}</span>
            )}
            <span className="fs-mono" style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, letterSpacing: '0.1em' }}>{t.cg_score || 'SCORE'} </span>
              {score.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div ref={bodyRef} className="no-sb" style={{ position: 'relative', zIndex: 2, flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', padding: '16px 22px 0' }}>
        <div className="fs-mono" style={{ fontSize: 12, letterSpacing: '0.24em', textTransform: 'uppercase', color: reveal ? (right ? MINT : ROSE) : SKY, fontWeight: 800 }}>
          {reveal ? (right ? (t.gw_correct || 'Correct!') : (t.gw_wrong || 'Nope.')) : (t.gw_eyebrow || 'WHO SAID THIS?')}
        </div>

        <div style={{ marginTop: 12 }}>
          <QuoteCard content={round.content} />
        </div>

        <div style={{ marginTop: 16 }}>
          <NameOptions options={round.options} picked={picked} correct={round.correct} reveal={reveal} colorFor={colorFor} onPick={onPick} />
        </div>

        {reveal && (
          <div className="a-fade-up" style={{ marginTop: 16, animationDelay: '0.06s' }}>
            <div className="fs-display" dir="auto" style={{
              fontSize: 'clamp(20px, 5.4vw, 26px)', fontWeight: 800, lineHeight: 1.2, letterSpacing: '-0.02em',
              backgroundImage: `linear-gradient(120deg, #fff 0%, ${right ? MINT : '#fff'} 100%)`,
              WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', WebkitTextFillColor: 'transparent',
            }}>
              {fill(t.gw_reveal || 'It was {name}.', { name: round.correct })}
              {lastGain > 0 && <span className="fs-mono" style={{ WebkitTextFillColor: GOLD, color: GOLD, fontSize: 16, marginInlineStart: 10 }}>+{lastGain.toLocaleString()}</span>}
            </div>
            {round.fact && (
              <div className="fs-sans" dir="auto" style={{ marginTop: 8, fontSize: 14.5, lineHeight: 1.45, color: 'rgba(255,255,255,0.72)', fontWeight: 500 }}>
                {round.fact}
              </div>
            )}
          </div>
        )}
        <div style={{ flex: 1, minHeight: 12 }} />
      </div>

      {/* Footer */}
      <div style={{ position: 'relative', zIndex: 3, padding: '14px 22px calc(env(safe-area-inset-bottom, 0px) + 18px)' }}>
        {reveal ? (
          <button onClick={onContinue} className="press" style={{
            width: '100%', padding: '17px', borderRadius: 999, border: 'none', cursor: 'pointer',
            background: '#fff', color: PLUM, fontWeight: 800, fontSize: 17, fontFamily: 'inherit',
            boxShadow: '0 12px 28px -10px rgba(255,255,255,0.5)',
          }}>{roundNum < roundTotal ? (t.cg_continue || 'Continue') : (t.gw_see_score || 'See my score')}</button>
        ) : (
          <div className="fs-mono" style={{ textAlign: 'center', padding: '12px 0', fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase' }}>
            {t.gw_tap_hint || 'Tap who you think said it'}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Finale score ───────────────────────────────────────────────
function ScoreScene({ t, iq, score, hits, total, bestStreak, onReplay, onBack }) {
  const g = gradeFor(t, iq);
  const CONFETTI = ['🎉', '✨', '🎊', '⭐', '💫', '🌟'];
  const pos = [{ top: '10%', left: '12%' }, { top: '16%', right: '14%' }, { top: '30%', left: '20%' }, { bottom: '26%', right: '16%' }, { bottom: '16%', left: '18%' }, { top: '44%', right: '10%' }];
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: GAME_BG, color: '#fff',
      display: 'flex', flexDirection: 'column',
      padding: 'calc(env(safe-area-inset-top, 0px) + 60px) 26px calc(env(safe-area-inset-bottom, 0px) + 28px)' }}>
      <FloatingBlobs tint={g.color} op={0.45} />
      {iq >= 70 && CONFETTI.map((e, i) => (
        <div key={i} className="a-float" aria-hidden style={{ position: 'absolute', ...pos[i], fontSize: 26 + (i % 3) * 6, animationDelay: `${(i * 0.22) % 1.5}s` }}>{e}</div>
      ))}
      <div style={{ position: 'relative', zIndex: 2, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
        <div className="fs-mono a-fade-up" style={{ fontSize: 12, letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', fontWeight: 800 }}>
          {t.cg_score_eyebrow || 'GAME OVER'}
        </div>
        <div className="fs-mono a-fade-up" style={{ marginTop: 22, fontSize: 13, letterSpacing: '0.26em', textTransform: 'uppercase', color: g.color, fontWeight: 800, animationDelay: '0.05s' }}>
          {t.gw_score_label || 'DETECTIVE IQ'}
        </div>
        <div className="fs-display a-spring" style={{
          fontSize: 'clamp(108px, 38vw, 180px)', fontWeight: 800, fontStyle: 'italic', lineHeight: 0.86, letterSpacing: '-0.06em',
          backgroundImage: `linear-gradient(180deg, #fff 0%, ${g.color} 95%)`,
          WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', WebkitTextFillColor: 'transparent',
          filter: `drop-shadow(0 10px 30px ${g.color}66)`,
        }}>{iq}<span style={{ fontSize: '0.4em' }}>%</span></div>
        <div className="fs-display a-fade-up" style={{ marginTop: 6, fontSize: 'clamp(28px, 8vw, 40px)', fontWeight: 800, fontStyle: 'italic', color: '#fff', letterSpacing: '-0.03em', animationDelay: '0.18s' }}>
          {g.title}
        </div>
        <div className="fs-sans a-fade-up" style={{ marginTop: 12, fontSize: 16, lineHeight: 1.45, color: 'rgba(255,255,255,0.78)', fontWeight: 500, maxWidth: 300, animationDelay: '0.28s' }}>
          {g.sub}
        </div>
        <div className="a-fade-up" style={{ marginTop: 26, display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', animationDelay: '0.38s' }}>
          {[
            fill(t.gw_score_correct || '{hits}/{total} correct', { hits, total }),
            fill(t.cg_score_best_streak || 'Best streak ×{n}', { n: bestStreak }),
            fill(t.cg_score_points || '{n} pts', { n: score.toLocaleString() }),
          ].map((s, i) => (
            <div key={i} className="fs-mono" style={{
              padding: '10px 14px', borderRadius: 14, background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.16)', fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.88)', letterSpacing: '0.04em',
            }}>{s}</div>
          ))}
        </div>
      </div>
      <div style={{ position: 'relative', zIndex: 2, display: 'flex', gap: 10 }}>
        <button onClick={onReplay} className="press" style={{
          flex: 1, padding: '16px', borderRadius: 999, border: 'none', cursor: 'pointer',
          background: `linear-gradient(135deg, ${SKY}, ${MAGENTA})`, color: '#fff', fontWeight: 800, fontSize: 16, fontFamily: 'inherit',
          boxShadow: `0 10px 26px -8px ${MAGENTA}88`,
        }}>{t.cg_replay || 'Play again'}</button>
        <button onClick={onBack} className="press" style={{
          flex: 1, padding: '16px', borderRadius: 999, cursor: 'pointer',
          background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1.5px solid rgba(255,255,255,0.22)', fontWeight: 800, fontSize: 16, fontFamily: 'inherit',
        }}>{t.cg_done || 'Done'}</button>
      </div>
    </div>
  );
}

// ── Main controller ────────────────────────────────────────────
export default function GuessWho({ analytics, t, onBack }) {
  const gw = analytics?.guessWho;
  const userMap = analytics?.userMap;
  const rounds = useMemo(() => buildRounds(gw, userMap, t), [gw, userMap, t]);
  const total = rounds.length;

  // Stable per-author colour across the whole game.
  const colorFor = useMemo(() => {
    const map = new Map();
    let ci = 0;
    for (const r of rounds) for (const name of r.options) {
      if (!map.has(name)) map.set(name, AUTHOR_COLORS[ci++ % AUTHOR_COLORS.length]);
    }
    return (name) => map.get(name) || CORAL;
  }, [rounds]);

  // step 0 = title, 1..total = rounds, total+1 = score.
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState(null);
  const [reveal, setReveal] = useState(false);
  const [lastGain, setLastGain] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [results, setResults] = useState([]); // booleans
  const bodyRef = useRef(null);

  useEffect(() => { if (bodyRef.current) bodyRef.current.scrollTop = 0; }, [step, reveal]);

  if (!gw || total === 0) {
    return <GuessWhoEmpty t={t} onBack={onBack} needsReupload={!gw} />;
  }

  const replay = () => {
    setStep(0); setPicked(null); setReveal(false); setLastGain(0);
    setScore(0); setStreak(0); setBestStreak(0); setResults([]);
  };

  const pick = (name) => {
    if (reveal) return;
    const round = rounds[step - 1];
    const right = name === round.correct;
    const streakAfter = right ? streak + 1 : 0;
    const mult = right ? Math.min(2, 1 + 0.25 * (streakAfter - 1)) : 1;
    const gained = right ? Math.round(BASE * mult) : 0;
    setPicked(name);
    setReveal(true);
    setLastGain(gained);
    setScore(s => s + gained);
    setStreak(streakAfter);
    setBestStreak(b => Math.max(b, streakAfter));
    setResults(r => [...r, right]);
  };

  const next = () => {
    if (step < total) { setStep(step + 1); setPicked(null); setReveal(false); setLastGain(0); }
    else { setStep(total + 1); }
  };

  // Title.
  if (step === 0) {
    return (
      <GameRoot onBack={onBack} t={t}>
        <TitleScene t={t} rounds={total} people={gw.authors?.length || 0} onStart={() => setStep(1)} />
      </GameRoot>
    );
  }

  // Score.
  if (step > total) {
    const hits = results.filter(Boolean).length;
    const iq = total ? Math.round((100 * hits) / total) : 0;
    return (
      <GameRoot onBack={onBack} t={t}>
        <ScoreScene t={t} iq={iq} score={score} hits={hits} total={total} bestStreak={bestStreak} onReplay={replay} onBack={onBack} />
      </GameRoot>
    );
  }

  // Question.
  return (
    <GameRoot onBack={onBack} t={t}>
      <QuestionScene
        round={rounds[step - 1]} t={t}
        picked={picked} reveal={reveal}
        roundNum={step} roundTotal={total}
        score={score} streak={streak} lastGain={lastGain}
        colorFor={colorFor}
        onPick={pick} onContinue={next}
        bodyRef={bodyRef}
      />
    </GameRoot>
  );
}

// Shared root: the always-present close button.
function GameRoot({ children, onBack, t }) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: PLUM, overflow: 'hidden' }}>
      {children}
      <button onClick={onBack} className="press" aria-label={t.a11y_close || 'Close'} style={{
        position: 'absolute', top: 'calc(env(safe-area-inset-top, 0px) + 12px)', insetInlineEnd: 14, zIndex: 10,
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

// ── Empty-state view ───────────────────────────────────────────
function GuessWhoEmpty({ t, onBack, needsReupload }) {
  const title = needsReupload
    ? (t.gw_empty_old_title || t.chaos_empty_old_title || 'Re-upload to unlock')
    : (t.gw_empty_title || 'Not enough to guess');
  const body = needsReupload
    ? (t.gw_empty_old_body || 'This recap was saved before this mode existed. Re-upload your chat to play.')
    : (t.gw_empty_body || 'This chat needs a couple more talkative people for a fair game.');
  return (
    <div style={{
      position: 'absolute', inset: 0, overflow: 'hidden',
      background: `linear-gradient(180deg, ${CREAM} 0%, #FFF0E2 46%, ${PINK} 100%)`,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '24px', gap: 12, textAlign: 'center',
    }}>
      <div aria-hidden style={{ fontSize: 64 }}>{needsReupload ? '📂' : '🕵️'}</div>
      <div className="fs-display" style={{ fontSize: 24, fontWeight: 800, color: PLUM }}>{title}</div>
      <div className="fs-sans" style={{ fontSize: 14, color: MUTED, maxWidth: 300 }}>{body}</div>
      <button onClick={onBack} className="press" style={{
        marginTop: 12, padding: '12px 22px', borderRadius: 999,
        background: `linear-gradient(135deg, ${GOLD}, ${CORAL})`, color: EGGPLANT,
        border: '2px solid rgba(255,255,255,0.8)', cursor: 'pointer', fontWeight: 800, fontSize: 14,
      }}>{t.rm_back || 'Back'}</button>
    </div>
  );
}
