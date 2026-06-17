// ============================================================
// GuessWho — "Who Said This?" (heavy TV trivia game-show skin)
//
// An endless quiz built from the deterministic `analytics.guessWho`
// quote pool. Each question shows a REAL message from the chat with the
// sender hidden, and four A/B/C/D answer lozenges. Lock one in → the
// studio lights flash, the correct answer locks green, points + streak
// combo land, and a fun-fact about the real sender appears.
//
// ENDLESS: questions keep coming. The pool (a finite set of best quotes)
// is cycled via a seeded shuffle and reshuffled when exhausted, so it
// feels infinite without immediate repeats. Three wrong answers ends the
// run → a "Studio IQ" finale you can replay.
//
// Pure + deterministic: the shuffle order, decoys and option order all
// come from a seeded PRNG keyed off content + counters held in React
// state — no Math.random / Date.now. Same chat → same game.
// ============================================================
import { useMemo, useRef, useState, useEffect, useCallback } from 'react';

// ── Game-show palette — a warm neon quiz studio ────────────────────
const STAGE      = '#120A2A';   // deep studio violet-black
const STAGE2     = '#1E1140';
const NEON       = '#22D3EE';   // cyan stage light
const HOT         = '#FF2D78';   // magenta accent
const GOLD         = '#FFC83A';   // prize gold
const GREEN        = '#39D98A';   // correct
const RED          = '#FF4D4D';   // wrong
const INK_DIM      = 'rgba(255,255,255,0.6)';
const LETTERS      = ['A', 'B', 'C', 'D'];
const LETTER_COLORS = [GOLD, NEON, HOT, '#A78BFA'];
const LIVES = 3;

// Full studio backdrop: rotating spotlight rays + vignette + sparkle.
const STAGE_BG = `radial-gradient(120% 90% at 50% -10%, ${STAGE2} 0%, ${STAGE} 60%)`;

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
function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2);
  return (parts[0][0] || '') + (parts[1][0] || '');
}

// One-line "fun fact" about the real sender.
function revealFact(u, t) {
  if (!u) return '';
  if (u.topWord && u.topWordCount >= 5) return fill(t.gw_fact_word, { word: u.topWord, n: u.topWordCount.toLocaleString() });
  if (u.topEmoji) return fill(t.gw_fact_emoji, { emoji: u.topEmoji });
  if (u.messageCount) return fill(t.gw_fact_msgs, { n: u.messageCount.toLocaleString() });
  return '';
}

// Build ONE question for a given quote: correct sender + 3 decoys, shuffled.
function makeQuestion(quote, authors, userMap, t, idx) {
  const optionCount = Math.min(4, authors.length);
  const seed = seedFromStr(quote.content + '|' + idx);
  const decoys = seededShuffle(authors.filter(a => a !== quote.author), seed).slice(0, optionCount - 1);
  const options = seededShuffle([quote.author, ...decoys], (seed ^ 0x9e3779b9) >>> 0);
  return { content: quote.content, correct: quote.author, options, fact: revealFact(userMap?.[quote.author], t) };
}

// An endless, deterministic feed of questions. The quote pool is finite
// (a curated "best" set), so we walk a seeded-shuffled order and reshuffle
// with a fresh derived seed once exhausted — feels infinite, never an
// immediate repeat, fully reproducible.
function makeQuoteFeed(gw) {
  const authors = (gw?.authors || []).filter(Boolean);
  const quotes = (gw?.quotes || []).filter(q => q?.content && q?.author);
  if (authors.length < 2 || quotes.length < 3) return null;
  const baseSeed = seedFromStr(quotes.map(q => q.content).join('¦'));
  let order = seededShuffle(quotes, baseSeed);
  let cursor = 0, cycle = 0;
  return {
    authors,
    poolSize: quotes.length,
    next() {
      if (cursor >= order.length) { cycle++; order = seededShuffle(quotes, (baseSeed ^ Math.imul(cycle, 0x9e3779b9)) >>> 0); cursor = 0; }
      return order[cursor++];
    },
  };
}

// ── Scoring ────────────────────────────────────────────────────
const BASE = 1000;
function gradeFor(t, hits) {
  // Endless: grade by total correct answers reached before running out of lives.
  if (hits >= 20) return { title: t.gw_grade_5_title, sub: t.gw_grade_5_sub, color: GOLD };
  if (hits >= 12) return { title: t.gw_grade_4_title, sub: t.gw_grade_4_sub, color: HOT };
  if (hits >= 7)  return { title: t.gw_grade_3_title, sub: t.gw_grade_3_sub, color: NEON };
  if (hits >= 3)  return { title: t.gw_grade_2_title, sub: t.gw_grade_2_sub, color: GOLD };
  return { title: t.gw_grade_1_title, sub: t.gw_grade_1_sub, color: RED };
}

// ── Studio backdrop chrome ─────────────────────────────────────
function Studio({ tint = NEON, children }) {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: STAGE_BG, color: '#fff', display: 'flex', flexDirection: 'column' }}>
      {/* rotating spotlight rays */}
      <div aria-hidden className="a-stage-rays" style={{
        position: 'absolute', top: '-30%', left: '50%', width: '160%', height: '120%', transform: 'translateX(-50%)',
        background: `repeating-conic-gradient(from 0deg at 50% 50%, ${tint}22 0deg 8deg, transparent 8deg 26deg)`,
        opacity: 0.5, pointerEvents: 'none',
      }} />
      {/* twin top spotlights */}
      <div aria-hidden style={{ position: 'absolute', top: '-16%', left: '20%', width: '60%', height: '60%', background: `radial-gradient(circle at 50% 0%, ${tint}33 0%, transparent 60%)`, pointerEvents: 'none' }} />
      {/* stage floor glow */}
      <div aria-hidden style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '34%', background: `radial-gradient(120% 100% at 50% 100%, ${HOT}26 0%, transparent 70%)`, pointerEvents: 'none' }} />
      <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'radial-gradient(130% 100% at 50% 40%, transparent 40%, rgba(0,0,0,0.55) 100%)', pointerEvents: 'none' }} />
      <div style={{ position: 'relative', zIndex: 2, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  );
}

// A marquee-bulb frame around a node (game-show signage feel).
function BulbFrame({ children, color = GOLD, style }) {
  const N = 7;
  return (
    <div style={{ position: 'relative', ...style }}>
      {children}
      {/* top + bottom bulb rows */}
      {['top', 'bottom'].map(edge => (
        <div key={edge} aria-hidden style={{ position: 'absolute', [edge]: -5, left: 10, right: 10, display: 'flex', justifyContent: 'space-between' }}>
          {Array.from({ length: N }).map((_, i) => (
            <span key={i} className="a-bulb" style={{ width: 5, height: 5, borderRadius: '50%', background: color, color, animationDelay: `${(i % 4) * 0.18}s` }} />
          ))}
        </div>
      ))}
    </div>
  );
}

// HUD lives row.
function Lives({ lives, lostPulse }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {Array.from({ length: LIVES }).map((_, i) => {
        const alive = i < lives;
        const justLost = lostPulse && i === lives;
        return (
          <span key={i} aria-hidden className={justLost ? 'a-life-lost' : ''} style={{ fontSize: 16, filter: alive ? 'none' : 'grayscale(1) opacity(0.35)' }}>❤️</span>
        );
      })}
    </div>
  );
}

// The quote "on the spotlight" — a tilted neon plaque, sender hidden.
function QuotePlaque({ content }) {
  return (
    <BulbFrame color={GOLD} style={{ width: '100%', maxWidth: 360 }}>
      <div dir="auto" className="a-plaque-drop" style={{
        position: 'relative', background: `linear-gradient(160deg, ${STAGE2} 0%, #160C36 100%)`,
        border: `2px solid ${GOLD}`, borderRadius: 18, padding: '20px 18px',
        boxShadow: `0 18px 44px -16px rgba(0,0,0,0.8), 0 0 0 4px rgba(255,200,58,0.12), inset 0 0 30px rgba(255,200,58,0.08)`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
          <div aria-hidden style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, background: 'rgba(255,255,255,0.1)', border: `2px dashed ${GOLD}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 900, color: GOLD }}>?</div>
          <div className="fs-mono" style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.4)' }}>• • • • • • •</div>
        </div>
        <div dir="auto" className="fs-sans" style={{ fontSize: 'clamp(18px, 5vw, 23px)', fontWeight: 600, lineHeight: 1.34, color: '#fff' }}>{content}</div>
      </div>
    </BulbFrame>
  );
}

// A single A/B/C/D answer lozenge — big, glowing, game-show styled.
function AnswerLozenge({ letter, color, name, idx, picked, correct, reveal, onPick }) {
  const selected = picked === name;
  const isCorrect = reveal && name === correct;
  const isWrongPick = reveal && selected && name !== correct;
  let bg = `linear-gradient(160deg, ${STAGE2} 0%, #160C36 100%)`;
  let bd = 'rgba(255,255,255,0.16)';
  let glow = '0 8px 22px -14px rgba(0,0,0,0.8)';
  let badgeBg = `${color}26`, badgeBd = color, badgeFg = color;
  let cls = 'a-ans-in';
  if (selected && !reveal) { bd = NEON; glow = `0 12px 30px -10px ${NEON}aa`; }
  if (isCorrect) { bg = `linear-gradient(160deg, ${GREEN}3a 0%, ${GREEN}1a 100%)`; bd = GREEN; glow = `0 12px 32px -8px ${GREEN}cc`; badgeBg = GREEN; badgeBd = GREEN; badgeFg = '#06281A'; cls = 'a-ans-in a-lock-flash'; }
  if (isWrongPick) { bg = `linear-gradient(160deg, ${RED}3a 0%, ${RED}14 100%)`; bd = RED; glow = 'none'; badgeBg = RED; badgeBd = RED; badgeFg = '#2A0606'; }
  const dim = reveal && !isCorrect && !isWrongPick;
  return (
    <button
      type="button" dir="auto" disabled={reveal}
      onClick={() => !reveal && onPick(name)}
      aria-pressed={!reveal ? selected : undefined}
      className={reveal ? cls : `press ${cls}`}
      style={{
        position: 'relative', textAlign: 'start', cursor: reveal ? 'default' : 'pointer',
        width: '100%', minHeight: 0, padding: '12px 14px', borderRadius: 16,
        border: `2.5px solid ${bd}`, background: bg, boxShadow: glow,
        color: '#fff', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 12,
        opacity: dim ? 0.45 : 1, animationDelay: `${idx * 0.06}s`,
        transition: 'background 0.2s, border-color 0.2s, box-shadow 0.2s, opacity 0.2s',
      }}>
      <div aria-hidden className="fs-display" style={{
        width: 40, height: 40, borderRadius: 12, flexShrink: 0, background: badgeBg,
        border: `2px solid ${badgeBd}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 19, fontWeight: 900, color: badgeFg,
      }}>{letter}</div>
      <span className="fs-sans" style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: 800, lineHeight: 1.15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
      {(isCorrect || isWrongPick) && <span aria-hidden style={{ fontSize: 19, flexShrink: 0 }}>{isCorrect ? '✅' : '❌'}</span>}
    </button>
  );
}

// ── Title / cold open ──────────────────────────────────────────
function TitleScene({ t, poolSize, people, onStart }) {
  return (
    <Studio tint={NEON}>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center',
        padding: 'calc(env(safe-area-inset-top, 0px) + 56px) 24px 8px' }}>
        <div className="fs-mono a-fade-up" style={{ fontSize: 12, letterSpacing: '0.3em', textTransform: 'uppercase', color: NEON, fontWeight: 800 }}>
          {t.gw_show_eyebrow || '🎬 ON THE SPOTLIGHT'}
        </div>
        <BulbFrame color={GOLD} style={{ marginTop: 22, alignSelf: 'center' }}>
          <div className="fs-display a-spring" style={{
            padding: '6px 4px', fontSize: 'clamp(40px, 12.5vw, 62px)', fontWeight: 800, fontStyle: 'italic',
            letterSpacing: '-0.04em', lineHeight: 0.95,
            backgroundImage: `linear-gradient(135deg, #fff 0%, ${GOLD} 45%, ${HOT} 100%)`,
            WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', WebkitTextFillColor: 'transparent',
            filter: `drop-shadow(0 8px 26px ${HOT}66)`,
          }}>{t.gw_show_title || 'WHO SAID THIS?!'}</div>
        </BulbFrame>
        <div className="fs-sans a-fade-up" style={{ marginTop: 22, fontSize: 16, lineHeight: 1.5, color: 'rgba(255,255,255,0.82)', fontWeight: 500, maxWidth: 330, alignSelf: 'center', animationDelay: '0.2s' }}>
          {t.gw_show_sub || 'Real messages. Names hidden. Keep guessing who sent each one — 3 strikes and the show’s over.'}
        </div>
        <div className="fs-mono a-fade-up" style={{ marginTop: 18, fontSize: 12, fontWeight: 800, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.5)', animationDelay: '0.3s' }}>
          {fill(t.gw_show_meta || '{people} contestants · endless rounds', { people })}
        </div>
      </div>
      <div style={{ flexShrink: 0, padding: '0 22px calc(env(safe-area-inset-bottom, 0px) + 18px)' }}>
        <button onClick={onStart} className="press a-fade-up" style={{
          width: '100%', height: '34vh', minHeight: 150, maxHeight: 300, borderRadius: 22, border: 'none', cursor: 'pointer',
          background: `linear-gradient(135deg, ${GOLD}, ${HOT} 85%)`, color: '#fff',
          fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 16px 38px -10px ${HOT}aa, 0 2px 0 rgba(255,255,255,0.4) inset`, animationDelay: '0.42s',
        }}>
          <span className="fs-display" style={{ fontSize: 26, fontWeight: 800, fontStyle: 'italic', letterSpacing: '-0.02em' }}>{t.gw_show_cta || 'Enter the studio'}</span>
        </button>
      </div>
    </Studio>
  );
}

// ── Question / play scene ──────────────────────────────────────
function QuestionScene({ q, t, picked, reveal, qNum, score, streak, lives, lostPulse, lastGain, scorePulse, onPick, onContinue, gameOverNext }) {
  const right = reveal && picked === q.correct;
  return (
    <Studio tint={reveal ? (right ? GREEN : RED) : NEON}>
      {/* HUD */}
      <div style={{ flexShrink: 0, padding: 'calc(env(safe-area-inset-top, 0px) + 14px) 18px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingInlineEnd: 44 }}>
          <Lives lives={lives} lostPulse={lostPulse} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {streak >= 2 && <span className="fs-mono a-pop-in" style={{ fontSize: 13, fontWeight: 900, color: GOLD }}>🔥 ×{streak}</span>}
            <span className={`fs-mono ${scorePulse ? 'a-score-pop' : ''}`} style={{ fontSize: 14, fontWeight: 900, color: '#fff', display: 'inline-block' }}>
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, letterSpacing: '0.1em' }}>{t.cg_score || 'SCORE'} </span>
              {score.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Body — fixed, no scroll */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 18px 0', gap: 12, overflow: 'hidden' }}>
        <div className="fs-mono" style={{ fontSize: 12, letterSpacing: '0.24em', textTransform: 'uppercase', color: reveal ? (right ? GREEN : RED) : NEON, fontWeight: 800 }}>
          {reveal ? (right ? (t.gw_correct || 'Correct!') : (t.gw_wrong || 'Nope.')) : fill(t.gw_question_n || 'Question {n}', { n: qNum })}
        </div>

        <QuotePlaque content={q.content} />

        {/* Answers — fill the rest of the stage */}
        <div style={{ width: '100%', maxWidth: 360, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 9 }}>
          {q.options.map((name, i) => (
            <AnswerLozenge key={name} letter={LETTERS[i]} color={LETTER_COLORS[i]} name={name} idx={i}
              picked={picked} correct={q.correct} reveal={reveal} onPick={onPick} />
          ))}
        </div>

        {reveal && (
          <div className="a-fade-up" style={{ width: '100%', maxWidth: 360, textAlign: 'center', animationDelay: '0.06s' }}>
            <div className="fs-display" dir="auto" style={{ fontSize: 'clamp(18px, 4.8vw, 23px)', fontWeight: 800, lineHeight: 1.2, letterSpacing: '-0.02em', color: '#fff' }}>
              {fill(t.gw_reveal || 'It was {name}.', { name: q.correct })}
              {lastGain > 0 && <span className="fs-mono" style={{ color: GOLD, fontSize: 16, marginInlineStart: 10 }}>+{lastGain.toLocaleString()}</span>}
            </div>
            {q.fact && <div className="fs-sans" dir="auto" style={{ marginTop: 5, fontSize: 13.5, lineHeight: 1.4, color: 'rgba(255,255,255,0.72)', fontWeight: 500 }}>{q.fact}</div>}
          </div>
        )}
      </div>

      {/* Footer action */}
      <div style={{ flexShrink: 0, padding: '12px 18px calc(env(safe-area-inset-bottom, 0px) + 16px)' }}>
        {reveal ? (
          <button onClick={onContinue} className="press" style={{
            width: '100%', padding: '18px', borderRadius: 16, border: 'none', cursor: 'pointer',
            background: gameOverNext ? `linear-gradient(135deg, ${RED}, ${HOT})` : '#fff',
            color: gameOverNext ? '#fff' : STAGE, fontFamily: 'inherit',
            boxShadow: gameOverNext ? `0 12px 30px -10px ${RED}aa` : '0 12px 28px -10px rgba(255,255,255,0.5)',
          }}>
            <span className="fs-display" style={{ fontSize: 19, fontWeight: 800, fontStyle: 'italic' }}>
              {gameOverNext ? (t.gw_show_over_cta || 'See how you did') : (t.gw_next_q || 'Next question')}
            </span>
          </button>
        ) : (
          <div className="fs-mono" style={{ textAlign: 'center', padding: '14px 0', fontSize: 12, fontWeight: 800, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase' }}>
            {t.gw_lock_hint || 'Lock in your answer'}
          </div>
        )}
      </div>
    </Studio>
  );
}

// ── Finale ─────────────────────────────────────────────────────
function ScoreScene({ t, hits, score, bestStreak, onReplay, onBack }) {
  const g = gradeFor(t, hits);
  const CONFETTI = ['🎉', '✨', '🎊', '⭐', '💫', '🌟'];
  const pos = [{ top: '8%', left: '12%' }, { top: '14%', right: '14%' }, { top: '28%', left: '18%' }, { bottom: '28%', right: '16%' }, { bottom: '18%', left: '16%' }, { top: '40%', right: '10%' }];
  return (
    <Studio tint={g.color}>
      {hits >= 7 && CONFETTI.map((e, i) => (
        <div key={i} className="a-float" aria-hidden style={{ position: 'absolute', ...pos[i], fontSize: 26 + (i % 3) * 6, animationDelay: `${(i * 0.22) % 1.5}s`, zIndex: 1 }}>{e}</div>
      ))}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center',
        padding: 'calc(env(safe-area-inset-top, 0px) + 50px) 24px 8px' }}>
        <div className="fs-mono a-fade-up" style={{ fontSize: 12, letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', fontWeight: 800 }}>
          {t.gw_show_over || "That's a wrap!"}
        </div>
        <div className="fs-mono a-fade-up" style={{ marginTop: 18, fontSize: 13, letterSpacing: '0.26em', textTransform: 'uppercase', color: g.color, fontWeight: 800, animationDelay: '0.05s' }}>
          {t.gw_streak_label || 'CORRECT ANSWERS'}
        </div>
        <BulbFrame color={g.color} style={{ marginTop: 6 }}>
          <div className="fs-display a-spring" style={{
            padding: '4px 12px', fontSize: 'clamp(96px, 34vw, 160px)', fontWeight: 800, fontStyle: 'italic', lineHeight: 0.86, letterSpacing: '-0.05em',
            backgroundImage: `linear-gradient(180deg, #fff 0%, ${g.color} 95%)`,
            WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', WebkitTextFillColor: 'transparent',
            filter: `drop-shadow(0 10px 30px ${g.color}66)`,
          }}>{hits}</div>
        </BulbFrame>
        <div className="fs-display a-fade-up" style={{ marginTop: 10, fontSize: 'clamp(26px, 7.5vw, 38px)', fontWeight: 800, fontStyle: 'italic', color: '#fff', letterSpacing: '-0.03em', animationDelay: '0.18s' }}>
          {g.title}
        </div>
        <div className="fs-sans a-fade-up" style={{ marginTop: 10, fontSize: 15, lineHeight: 1.45, color: 'rgba(255,255,255,0.78)', fontWeight: 500, maxWidth: 300, animationDelay: '0.28s' }}>
          {g.sub}
        </div>
        <div className="a-fade-up" style={{ marginTop: 22, display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', animationDelay: '0.38s' }}>
          {[
            fill(t.gw_score_answered || '{hits} correct', { hits }),
            fill(t.cg_score_best_streak || 'Best streak ×{n}', { n: bestStreak }),
            fill(t.cg_score_points || '{n} pts', { n: score.toLocaleString() }),
          ].map((s, i) => (
            <div key={i} className="fs-mono" style={{ padding: '10px 14px', borderRadius: 14, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.16)', fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.88)', letterSpacing: '0.04em' }}>{s}</div>
          ))}
        </div>
      </div>
      <div style={{ flexShrink: 0, display: 'flex', gap: 10, padding: '0 22px calc(env(safe-area-inset-bottom, 0px) + 18px)' }}>
        <button onClick={onReplay} className="press" style={{ flex: 1, padding: '17px', borderRadius: 16, border: 'none', cursor: 'pointer', background: `linear-gradient(135deg, ${GOLD}, ${HOT})`, color: '#fff', fontFamily: 'inherit', boxShadow: `0 12px 28px -8px ${HOT}aa` }}>
          <span className="fs-display" style={{ fontSize: 17, fontWeight: 800, fontStyle: 'italic' }}>{t.cg_replay || 'Play again'}</span>
        </button>
        <button onClick={onBack} className="press" style={{ flex: 1, padding: '17px', borderRadius: 16, cursor: 'pointer', background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1.5px solid rgba(255,255,255,0.22)', fontFamily: 'inherit' }}>
          <span className="fs-display" style={{ fontSize: 17, fontWeight: 800, fontStyle: 'italic' }}>{t.cg_done || 'Done'}</span>
        </button>
      </div>
    </Studio>
  );
}

// ── Main controller ────────────────────────────────────────────
export default function GuessWho({ analytics, t, onBack }) {
  const gw = analytics?.guessWho;
  const userMap = analytics?.userMap;
  const feed = useMemo(() => makeQuoteFeed(gw), [gw]);

  // phase: 'title' | 'play' | 'over'
  const [phase, setPhase] = useState('title');
  const [q, setQ] = useState(null);
  const [qNum, setQNum] = useState(0);
  const [picked, setPicked] = useState(null);
  const [reveal, setReveal] = useState(false);
  const [lastGain, setLastGain] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [hits, setHits] = useState(0);
  const [lives, setLives] = useState(LIVES);
  const [lostPulse, setLostPulse] = useState(false);
  const [scorePulse, setScorePulse] = useState(false);
  const idxRef = useRef(0);

  const serveNext = useCallback(() => {
    const quote = feed.next();
    setQ(makeQuestion(quote, feed.authors, userMap, t, idxRef.current++));
    setQNum(n => n + 1);
    setPicked(null); setReveal(false); setLastGain(0); setLostPulse(false);
  }, [feed, userMap, t]);

  const start = useCallback(() => {
    idxRef.current = 0;
    setScore(0); setStreak(0); setBestStreak(0); setHits(0); setLives(LIVES); setQNum(0);
    const quote = feed.next();
    setQ(makeQuestion(quote, feed.authors, userMap, t, idxRef.current++));
    setQNum(1); setPicked(null); setReveal(false); setLastGain(0);
    setPhase('play');
  }, [feed, userMap, t]);

  const pick = useCallback((name) => {
    if (reveal || !q) return;
    const right = name === q.correct;
    const streakAfter = right ? streak + 1 : 0;
    const mult = right ? Math.min(3, 1 + 0.25 * (streakAfter - 1)) : 1;
    const gained = right ? Math.round(BASE * mult) : 0;
    setPicked(name); setReveal(true); setLastGain(gained);
    if (right) {
      setScore(s => s + gained); setScorePulse(true); setTimeout(() => setScorePulse(false), 480);
      setStreak(streakAfter); setBestStreak(b => Math.max(b, streakAfter)); setHits(h => h + 1);
    } else {
      setStreak(0); setLives(l => l - 1); setLostPulse(true);
    }
  }, [reveal, q, streak]);

  const cont = useCallback(() => {
    if (lives <= 0) { setPhase('over'); return; }
    serveNext();
  }, [lives, serveNext]);

  const gameOverNext = reveal && lives <= 0;

  if (!feed) return <GuessWhoEmpty t={t} onBack={onBack} needsReupload={!gw} />;

  return (
    <GameRoot onBack={onBack} t={t}>
      {phase === 'title' && <TitleScene t={t} poolSize={feed.poolSize} people={feed.authors.length} onStart={start} />}
      {phase === 'play' && q && (
        <QuestionScene q={q} t={t} picked={picked} reveal={reveal} qNum={qNum} score={score} streak={streak}
          lives={lives} lostPulse={lostPulse} lastGain={lastGain} scorePulse={scorePulse}
          onPick={pick} onContinue={cont} gameOverNext={gameOverNext} />
      )}
      {phase === 'over' && <ScoreScene t={t} hits={hits} score={score} bestStreak={bestStreak} onReplay={start} onBack={onBack} />}
    </GameRoot>
  );
}

// Shared root: the always-present close button.
function GameRoot({ children, onBack, t }) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: STAGE, overflow: 'hidden' }}>
      {children}
      <button onClick={onBack} className="press" aria-label={t.a11y_close || 'Close'} style={{
        position: 'absolute', top: 'calc(env(safe-area-inset-top, 0px) + 12px)', insetInlineEnd: 14, zIndex: 10,
        background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
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
    ? (t.gw_empty_old_title || 'Re-upload to unlock')
    : (t.gw_empty_title || 'Not enough to guess');
  const body = needsReupload
    ? (t.gw_empty_old_body || 'This recap was saved before this mode existed. Re-upload your chat to play.')
    : (t.gw_empty_body || 'This chat needs a couple more talkative people for a fair game.');
  return (
    <Studio tint={NEON}>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '24px', gap: 12 }}>
        <div aria-hidden style={{ fontSize: 64 }}>{needsReupload ? '📂' : '🎬'}</div>
        <div className="fs-display" style={{ fontSize: 24, fontWeight: 800, fontStyle: 'italic', color: '#fff' }}>{title}</div>
        <div className="fs-sans" style={{ fontSize: 14, color: INK_DIM, maxWidth: 300 }}>{body}</div>
        <button onClick={onBack} className="press" style={{ marginTop: 12, padding: '14px 26px', borderRadius: 16, background: `linear-gradient(135deg, ${GOLD}, ${HOT})`, color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
          <span className="fs-display" style={{ fontSize: 16, fontWeight: 800, fontStyle: 'italic' }}>{t.rm_back || 'Back'}</span>
        </button>
      </div>
    </Studio>
  );
}
