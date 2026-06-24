// ============================================================
// Two Truths & a Lie — "Spot the lie" interrogation game.
//
// Endless single-player game built from the deterministic
// `makeTwoTruthsFeed` engine (src/lib/twoTruths.js). Each round is
// about ONE chat member: three claims about them, two REAL and one
// FABRICATED-but-plausible. Tap the lie → the room's polygraph
// stamps each card TRUE / LIE, the real number behind the lie is
// revealed, and points + a streak combo land.
//
// ENDLESS: rounds keep coming (the engine cycles subjects with a
// seeded reshuffle), three wrong calls ends the run → a "Lie
// Detector" finale you can replay.
//
// Pure + deterministic: every claim, lie and option order comes from
// the engine's seeded PRNG — no Math.random / Date.now. Same chat →
// same game. The view only renders {key, vars} pairs through i18n.
// ============================================================
import { useMemo, useState, useCallback } from 'react';
import { makeTwoTruthsFeed, hasTwoTruthsData } from '../lib/twoTruths.js';

// ── Interrogation-room palette — deliberately distinct from the
//    neon TV studio of Guess Who (violet/cyan) so the two modes feel
//    like different shows. Here: a cold polygraph teal-slate. ───────
const INK      = '#0A1416';   // deep slate-teal (room)
const INK2     = '#0F2024';
const TEAL     = '#2DD4BF';   // accent / scan light
const TRUTH    = '#34D399';   // verified green
const LIE       = '#FB7185';   // exposed red
const AMBER     = '#FBBF24';   // stamp / streak gold
const INK_DIM   = 'rgba(225,245,244,0.62)';
const LETTERS   = ['A', 'B', 'C'];
const LIVES     = 3;
const BASE      = 1000;

const ROOM_BG = `radial-gradient(120% 90% at 50% -8%, ${INK2} 0%, ${INK} 62%)`;

// ── Pure helpers ───────────────────────────────────────────────
function fill(str, vars) {
  return String(str ?? '').replace(/\{(\w+)\}/g, (_, k) => (vars && k in vars ? vars[k] : `{${k}}`));
}
function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2);
  return (parts[0][0] || '') + (parts[1][0] || '');
}

// ── Scoring ────────────────────────────────────────────────────
function gradeFor(t, hits) {
  if (hits >= 20) return { title: t.tt_grade_5_title, sub: t.tt_grade_5_sub, color: AMBER };
  if (hits >= 12) return { title: t.tt_grade_4_title, sub: t.tt_grade_4_sub, color: TRUTH };
  if (hits >= 7)  return { title: t.tt_grade_3_title, sub: t.tt_grade_3_sub, color: TEAL };
  if (hits >= 3)  return { title: t.tt_grade_2_title, sub: t.tt_grade_2_sub, color: AMBER };
  return { title: t.tt_grade_1_title, sub: t.tt_grade_1_sub, color: LIE };
}

// ── Room backdrop chrome ───────────────────────────────────────
function Room({ tint = TEAL, children }) {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: ROOM_BG, color: '#fff', display: 'flex', flexDirection: 'column' }}>
      {/* single hanging interrogation lamp — a soft cone from the top */}
      <div aria-hidden style={{ position: 'absolute', top: '-22%', left: '50%', width: '120%', height: '78%', transform: 'translateX(-50%)',
        background: `radial-gradient(closest-side, ${tint}26 0%, transparent 72%)`, pointerEvents: 'none', transition: 'background 0.35s' }} />
      {/* slow horizontal polygraph scan line */}
      <div aria-hidden className="tt-scan" style={{ position: 'absolute', left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, transparent, ${tint}aa, transparent)`, opacity: 0.5, pointerEvents: 'none' }} />
      {/* floor + vignette */}
      <div aria-hidden style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '34%', background: `radial-gradient(120% 100% at 50% 100%, ${tint}1f 0%, transparent 70%)`, pointerEvents: 'none' }} />
      <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'radial-gradient(130% 100% at 50% 42%, transparent 42%, rgba(0,0,0,0.6) 100%)', pointerEvents: 'none' }} />
      <div style={{ position: 'relative', zIndex: 2, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
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
          <span key={i} aria-hidden className={justLost ? 'tt-life-lost' : ''} style={{ fontSize: 16, filter: alive ? 'none' : 'grayscale(1) opacity(0.32)' }}>❤️</span>
        );
      })}
    </div>
  );
}

// Subject avatar — the person whose claims are on trial.
function SubjectChip({ name }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div aria-hidden className="fs-display" style={{
        width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
        background: `linear-gradient(150deg, ${TEAL} 0%, #0E7C73 100%)`,
        color: '#04201D', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22, fontWeight: 900, textTransform: 'uppercase',
        border: '2px solid rgba(255,255,255,0.22)', boxShadow: `0 10px 26px -8px ${TEAL}99`,
      }}>{initials(name)}</div>
      <div dir="auto" className="fs-display" style={{ fontSize: 'clamp(22px, 6.4vw, 30px)', fontWeight: 800, lineHeight: 1, letterSpacing: '-0.03em', color: '#fff', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {name}
      </div>
    </div>
  );
}

// A single claim card. Tappable until reveal; after reveal it wears its
// verdict stamp (TRUE / LIE) and the lie card shows the real number.
function ClaimCard({ letter, text, idx, picked, isLie, reveal, truthText, t, onPick }) {
  const selected = picked === idx;
  let bg = `linear-gradient(160deg, ${INK2} 0%, #0A171A 100%)`;
  let bd = 'rgba(255,255,255,0.15)';
  let glow = '0 8px 22px -14px rgba(0,0,0,0.85)';
  let badgeBg = `${TEAL}22`, badgeBd = TEAL, badgeFg = TEAL;

  if (selected && !reveal) { bd = TEAL; glow = `0 12px 30px -10px ${TEAL}aa`; }
  if (reveal && isLie) { bg = `linear-gradient(160deg, ${LIE}38 0%, ${LIE}12 100%)`; bd = LIE; glow = `0 12px 32px -8px ${LIE}aa`; badgeBg = LIE; badgeBd = LIE; badgeFg = '#2A0610'; }
  else if (reveal && !isLie) { bg = `linear-gradient(160deg, ${TRUTH}2e 0%, ${TRUTH}10 100%)`; bd = TRUTH; badgeBg = TRUTH; badgeBd = TRUTH; badgeFg = '#04261A'; }
  const dim = reveal && !isLie && !selected;

  return (
    <button
      type="button" dir="auto" disabled={reveal}
      onClick={() => !reveal && onPick(idx)}
      aria-pressed={!reveal ? selected : undefined}
      className={reveal ? 'tt-card-in' : 'press tt-card-in'}
      style={{
        position: 'relative', textAlign: 'start', cursor: reveal ? 'default' : 'pointer',
        width: '100%', minHeight: 0, padding: '14px 15px', borderRadius: 16,
        border: `2.5px solid ${bd}`, background: bg, boxShadow: glow,
        color: '#fff', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 13,
        opacity: dim ? 0.5 : 1, animationDelay: `${idx * 0.07}s`,
        transition: 'background 0.22s, border-color 0.22s, box-shadow 0.22s, opacity 0.22s',
      }}>
      <div aria-hidden className="fs-display" style={{
        width: 38, height: 38, borderRadius: 11, flexShrink: 0, background: badgeBg,
        border: `2px solid ${badgeBd}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, fontWeight: 900, color: badgeFg,
      }}>{letter}</div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <span className="fs-sans" style={{ display: 'block', fontSize: 16, fontWeight: 700, lineHeight: 1.28 }}>{text}</span>
        {reveal && isLie && truthText && (
          <span className="fs-mono tt-reveal-in" style={{ display: 'block', marginTop: 5, fontSize: 12.5, fontWeight: 700, color: '#fff', opacity: 0.92 }}>
            {t.tt_truth_label || 'Really:'} <span style={{ color: AMBER }}>{truthText}</span>
          </span>
        )}
      </div>

      {reveal && (
        <span aria-hidden className="fs-mono tt-stamp" style={{
          flexShrink: 0, alignSelf: 'flex-start', marginTop: 2,
          padding: '3px 8px', borderRadius: 7, fontSize: 10.5, fontWeight: 900, letterSpacing: '0.12em',
          color: isLie ? '#2A0610' : '#04261A', background: isLie ? LIE : TRUTH,
        }}>{isLie ? (t.tt_stamp_lie || 'LIE') : (t.tt_stamp_true || 'TRUE')}</span>
      )}
    </button>
  );
}

// ── Title / cold open ──────────────────────────────────────────
function TitleScene({ t, people, onStart }) {
  return (
    <Room tint={TEAL}>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center',
        padding: 'calc(env(safe-area-inset-top, 0px) + 56px) 24px 8px' }}>
        <div className="fs-mono tt-fade-up" style={{ fontSize: 12, letterSpacing: '0.3em', textTransform: 'uppercase', color: TEAL, fontWeight: 800 }}>
          {t.tt_eyebrow || '🔎 LIE DETECTOR'}
        </div>
        <div className="fs-display tt-spring" style={{
          marginTop: 18, padding: '4px 2px', fontSize: 'clamp(38px, 12vw, 60px)', fontWeight: 800, fontStyle: 'italic',
          letterSpacing: '-0.04em', lineHeight: 0.95, whiteSpace: 'pre-line',
          backgroundImage: `linear-gradient(135deg, #fff 0%, ${TEAL} 48%, ${TRUTH} 100%)`,
          WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', WebkitTextFillColor: 'transparent',
          filter: `drop-shadow(0 8px 26px ${TEAL}66)`,
        }}>{t.tt_title || 'TWO TRUTHS\n& A LIE'}</div>
        <div className="fs-sans tt-fade-up" style={{ marginTop: 20, fontSize: 16, lineHeight: 1.5, color: 'rgba(235,250,249,0.82)', fontWeight: 500, maxWidth: 330, alignSelf: 'center', animationDelay: '0.2s' }}>
          {t.tt_sub || 'Three claims about someone in the chat. Two are real. One is fake. Tap the lie — three strikes and the interrogation ends.'}
        </div>
        <div className="fs-mono tt-fade-up" style={{ marginTop: 18, fontSize: 12, fontWeight: 800, letterSpacing: '0.12em', color: 'rgba(235,250,249,0.5)', animationDelay: '0.3s' }}>
          {fill(t.tt_meta || '{people} suspects · endless rounds', { people })}
        </div>
      </div>
      <div style={{ flexShrink: 0, padding: '0 22px calc(env(safe-area-inset-bottom, 0px) + 18px)' }}>
        <button onClick={onStart} className="press tt-fade-up" style={{
          width: '100%', height: '32vh', minHeight: 148, maxHeight: 290, borderRadius: 22, border: 'none', cursor: 'pointer',
          background: `linear-gradient(135deg, ${TEAL}, #0E7C73 90%)`, color: '#04201D',
          fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 16px 38px -10px ${TEAL}aa, 0 2px 0 rgba(255,255,255,0.4) inset`, animationDelay: '0.42s',
        }}>
          <span className="fs-display" style={{ fontSize: 25, fontWeight: 800, fontStyle: 'italic', letterSpacing: '-0.02em' }}>{t.tt_cta || 'Start the interrogation'}</span>
        </button>
      </div>
    </Room>
  );
}

// ── Round / play scene ─────────────────────────────────────────
function RoundScene({ round, t, picked, reveal, qNum, score, streak, lives, lostPulse, lastGain, scorePulse, onPick, onContinue, gameOverNext }) {
  const right = reveal && picked === round.lieIndex;
  const truthText = round.lieReveal ? fill(t[round.lieReveal.key], round.lieReveal.truthVars) : '';
  return (
    <Room tint={reveal ? (right ? TRUTH : LIE) : TEAL}>
      {/* HUD */}
      <div style={{ flexShrink: 0, padding: 'calc(env(safe-area-inset-top, 0px) + 14px) 18px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingInlineEnd: 44 }}>
          <Lives lives={lives} lostPulse={lostPulse} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {streak >= 2 && <span className="fs-mono tt-pop-in" style={{ fontSize: 13, fontWeight: 900, color: AMBER }}>🔥 ×{streak}</span>}
            <span className={`fs-mono ${scorePulse ? 'tt-score-pop' : ''}`} style={{ fontSize: 14, fontWeight: 900, color: '#fff', display: 'inline-block' }}>
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, letterSpacing: '0.1em' }}>{t.tt_score || 'SCORE'} </span>
              {score.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Body — fixed, no scroll */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 18px 0', gap: 12, overflow: 'hidden' }}>
        <div className="fs-mono" style={{ fontSize: 12, letterSpacing: '0.24em', textTransform: 'uppercase', color: reveal ? (right ? TRUTH : LIE) : TEAL, fontWeight: 800 }}>
          {reveal
            ? (right ? (t.tt_correct || 'Lie exposed!') : (t.tt_wrong || 'That one was true.'))
            : fill(t.tt_round_n || 'Case {n}', { n: qNum })}
        </div>

        <SubjectChip name={round.subject} />

        {!reveal && (
          <div className="fs-mono" style={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: INK_DIM, fontWeight: 800 }}>
            {t.tt_prompt || 'One of these is a lie'}
          </div>
        )}

        {/* Claim cards — fill the rest of the room */}
        <div style={{ width: '100%', maxWidth: 380, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10 }}>
          {round.cards.map((c, i) => (
            <ClaimCard key={c.id} letter={LETTERS[i]} idx={i}
              text={fill(t[c.key], c.vars)} isLie={i === round.lieIndex}
              picked={picked} reveal={reveal} truthText={truthText} t={t} onPick={onPick} />
          ))}
        </div>

        {reveal && lastGain > 0 && (
          <div className="fs-mono tt-fade-up" style={{ color: AMBER, fontSize: 16, fontWeight: 900 }}>+{lastGain.toLocaleString()}</div>
        )}
      </div>

      {/* Footer action */}
      <div style={{ flexShrink: 0, padding: '10px 18px calc(env(safe-area-inset-bottom, 0px) + 16px)' }}>
        {reveal ? (
          <button onClick={onContinue} className="press" style={{
            width: '100%', padding: '18px', borderRadius: 16, border: 'none', cursor: 'pointer',
            background: gameOverNext ? `linear-gradient(135deg, ${LIE}, #C2415A)` : '#fff',
            color: gameOverNext ? '#fff' : INK, fontFamily: 'inherit',
            boxShadow: gameOverNext ? `0 12px 30px -10px ${LIE}aa` : '0 12px 28px -10px rgba(255,255,255,0.5)',
          }}>
            <span className="fs-display" style={{ fontSize: 19, fontWeight: 800, fontStyle: 'italic' }}>
              {gameOverNext ? (t.tt_over_cta || 'See the verdict') : (t.tt_next || 'Next case')}
            </span>
          </button>
        ) : (
          <div className="fs-mono" style={{ textAlign: 'center', padding: '14px 0', fontSize: 12, fontWeight: 800, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase' }}>
            {t.tt_lock_hint || 'Tap the card you think is fake'}
          </div>
        )}
      </div>
    </Room>
  );
}

// ── Finale ─────────────────────────────────────────────────────
function ScoreScene({ t, hits, score, bestStreak, onReplay, onBack }) {
  const g = gradeFor(t, hits);
  const CONFETTI = ['🔎', '✅', '🚫', '⭐', '💫', '🕵️'];
  const pos = [{ top: '8%', left: '12%' }, { top: '14%', right: '14%' }, { top: '28%', left: '18%' }, { bottom: '28%', right: '16%' }, { bottom: '18%', left: '16%' }, { top: '40%', right: '10%' }];
  return (
    <Room tint={g.color}>
      {hits >= 7 && CONFETTI.map((e, i) => (
        <div key={i} className="tt-float" aria-hidden style={{ position: 'absolute', ...pos[i], fontSize: 24 + (i % 3) * 6, animationDelay: `${(i * 0.22) % 1.5}s`, zIndex: 1 }}>{e}</div>
      ))}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center',
        padding: 'calc(env(safe-area-inset-top, 0px) + 50px) 24px 8px' }}>
        <div className="fs-mono tt-fade-up" style={{ fontSize: 12, letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', fontWeight: 800 }}>
          {t.tt_over || 'Case closed'}
        </div>
        <div className="fs-mono tt-fade-up" style={{ marginTop: 18, fontSize: 13, letterSpacing: '0.26em', textTransform: 'uppercase', color: g.color, fontWeight: 800, animationDelay: '0.05s' }}>
          {t.tt_lies_caught || 'LIES CAUGHT'}
        </div>
        <div className="fs-display tt-spring" style={{
          marginTop: 6, padding: '4px 12px', fontSize: 'clamp(96px, 34vw, 160px)', fontWeight: 800, fontStyle: 'italic', lineHeight: 0.86, letterSpacing: '-0.05em',
          backgroundImage: `linear-gradient(180deg, #fff 0%, ${g.color} 95%)`,
          WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', WebkitTextFillColor: 'transparent',
          filter: `drop-shadow(0 10px 30px ${g.color}66)`,
        }}>{hits}</div>
        <div className="fs-display tt-fade-up" style={{ marginTop: 8, fontSize: 'clamp(26px, 7.5vw, 38px)', fontWeight: 800, fontStyle: 'italic', color: '#fff', letterSpacing: '-0.03em', animationDelay: '0.18s' }}>
          {g.title}
        </div>
        <div className="fs-sans tt-fade-up" style={{ marginTop: 10, fontSize: 15, lineHeight: 1.45, color: 'rgba(235,250,249,0.78)', fontWeight: 500, maxWidth: 300, animationDelay: '0.28s' }}>
          {g.sub}
        </div>
        <div className="tt-fade-up" style={{ marginTop: 22, display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', animationDelay: '0.38s' }}>
          {[
            fill(t.tt_score_caught || '{hits} caught', { hits }),
            fill(t.tt_score_streak || 'Best streak ×{n}', { n: bestStreak }),
            fill(t.tt_score_points || '{n} pts', { n: score.toLocaleString() }),
          ].map((s, i) => (
            <div key={i} className="fs-mono" style={{ padding: '10px 14px', borderRadius: 14, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.16)', fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.88)', letterSpacing: '0.04em' }}>{s}</div>
          ))}
        </div>
      </div>
      <div style={{ flexShrink: 0, display: 'flex', gap: 10, padding: '0 22px calc(env(safe-area-inset-bottom, 0px) + 18px)' }}>
        <button onClick={onReplay} className="press" style={{ flex: 1, padding: '17px', borderRadius: 16, border: 'none', cursor: 'pointer', background: `linear-gradient(135deg, ${TEAL}, #0E7C73)`, color: '#04201D', fontFamily: 'inherit', boxShadow: `0 12px 28px -8px ${TEAL}aa` }}>
          <span className="fs-display" style={{ fontSize: 17, fontWeight: 800, fontStyle: 'italic' }}>{t.tt_replay || 'Play again'}</span>
        </button>
        <button onClick={onBack} className="press" style={{ flex: 1, padding: '17px', borderRadius: 16, cursor: 'pointer', background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1.5px solid rgba(255,255,255,0.22)', fontFamily: 'inherit' }}>
          <span className="fs-display" style={{ fontSize: 17, fontWeight: 800, fontStyle: 'italic' }}>{t.tt_done || 'Done'}</span>
        </button>
      </div>
    </Room>
  );
}

// ── Empty-state view ───────────────────────────────────────────
function TwoTruthsEmpty({ t, onBack, needsReupload }) {
  const title = needsReupload
    ? (t.tt_empty_old_title || 'Re-upload to play')
    : (t.tt_empty_title || 'Not enough to go on');
  const body = needsReupload
    ? (t.tt_empty_old_body || 'This recap was saved before this mode existed. Re-upload your chat to play.')
    : (t.tt_empty_body || 'This chat needs a few more active people to build fair claims.');
  return (
    <Room tint={TEAL}>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '24px', gap: 12 }}>
        <div aria-hidden style={{ fontSize: 64 }}>{needsReupload ? '📂' : '🔎'}</div>
        <div className="fs-display" style={{ fontSize: 24, fontWeight: 800, fontStyle: 'italic', color: '#fff' }}>{title}</div>
        <div className="fs-sans" style={{ fontSize: 14, color: INK_DIM, maxWidth: 300 }}>{body}</div>
        <button onClick={onBack} className="press" style={{ marginTop: 12, padding: '14px 26px', borderRadius: 16, background: `linear-gradient(135deg, ${TEAL}, #0E7C73)`, color: '#04201D', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
          <span className="fs-display" style={{ fontSize: 16, fontWeight: 800, fontStyle: 'italic' }}>{t.rm_back || t.tt_done || 'Back'}</span>
        </button>
      </div>
    </Room>
  );
}

// Local keyframes — scoped with a `tt-` prefix so they never collide with
// GlobalStyles. Kept here to keep the mode self-contained.
const STYLE = `
@keyframes ttScan { 0% { top: 12%; } 50% { top: 84%; } 100% { top: 12%; } }
.tt-scan { animation: ttScan 5.5s ease-in-out infinite; }
@keyframes ttFadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
.tt-fade-up { animation: ttFadeUp 0.5s cubic-bezier(0.2,0.7,0.3,1) both; }
@keyframes ttSpring { 0% { opacity: 0; transform: scale(0.8); } 60% { transform: scale(1.04); } 100% { opacity: 1; transform: scale(1); } }
.tt-spring { animation: ttSpring 0.55s cubic-bezier(0.2,0.8,0.2,1) both; }
@keyframes ttCardIn { from { opacity: 0; transform: translateY(8px) scale(0.99); } to { opacity: 1; transform: none; } }
.tt-card-in { animation: ttCardIn 0.4s cubic-bezier(0.2,0.7,0.3,1) both; }
@keyframes ttPopIn { 0% { opacity: 0; transform: scale(0.5); } 70% { transform: scale(1.15); } 100% { opacity: 1; transform: scale(1); } }
.tt-pop-in { animation: ttPopIn 0.35s cubic-bezier(0.2,0.8,0.2,1) both; }
@keyframes ttStamp { 0% { opacity: 0; transform: scale(1.8) rotate(-9deg); } 60% { transform: scale(0.92) rotate(-9deg); } 100% { opacity: 1; transform: scale(1) rotate(-4deg); } }
.tt-stamp { display: inline-block; animation: ttStamp 0.34s cubic-bezier(0.2,0.9,0.3,1) both; }
@keyframes ttRevealIn { from { opacity: 0; } to { opacity: 1; } }
.tt-reveal-in { animation: ttRevealIn 0.45s ease 0.1s both; }
@keyframes ttScorePop { 0% { transform: scale(1); } 40% { transform: scale(1.28); } 100% { transform: scale(1); } }
.tt-score-pop { animation: ttScorePop 0.45s cubic-bezier(0.2,0.8,0.2,1); }
@keyframes ttLifeLost { 0% { transform: scale(1); } 30% { transform: scale(1.5); filter: brightness(1.6); } 100% { transform: scale(1); } }
.tt-life-lost { animation: ttLifeLost 0.5s ease; }
@keyframes ttFloat { 0% { transform: translateY(0) rotate(-6deg); } 50% { transform: translateY(-12px) rotate(6deg); } 100% { transform: translateY(0) rotate(-6deg); } }
.tt-float { animation: ttFloat 3.2s ease-in-out infinite; }
`;

// ── Main controller ────────────────────────────────────────────
export default function TwoTruths({ analytics, t, onBack }) {
  const feed = useMemo(() => makeTwoTruthsFeed(analytics), [analytics]);

  // phase: 'title' | 'play' | 'over'
  const [phase, setPhase] = useState('title');
  const [round, setRound] = useState(null);
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

  const serveNext = useCallback(() => {
    setRound(feed.next());
    setQNum((n) => n + 1);
    setPicked(null); setReveal(false); setLastGain(0); setLostPulse(false);
  }, [feed]);

  const start = useCallback(() => {
    setScore(0); setStreak(0); setBestStreak(0); setHits(0); setLives(LIVES);
    setRound(feed.next());
    setQNum(1); setPicked(null); setReveal(false); setLastGain(0);
    setPhase('play');
  }, [feed]);

  const pick = useCallback((idx) => {
    if (reveal || !round) return;
    const right = idx === round.lieIndex;
    const streakAfter = right ? streak + 1 : 0;
    const mult = right ? Math.min(3, 1 + 0.25 * (streakAfter - 1)) : 1;
    const gained = right ? Math.round(BASE * mult) : 0;
    setPicked(idx); setReveal(true); setLastGain(gained);
    if (right) {
      setScore((s) => s + gained); setScorePulse(true); setTimeout(() => setScorePulse(false), 480);
      setStreak(streakAfter); setBestStreak((b) => Math.max(b, streakAfter)); setHits((h) => h + 1);
    } else {
      setStreak(0); setLives((l) => l - 1); setLostPulse(true);
    }
  }, [reveal, round, streak]);

  const cont = useCallback(() => {
    if (lives <= 0) { setPhase('over'); return; }
    serveNext();
  }, [lives, serveNext]);

  const gameOverNext = reveal && lives <= 0;

  return (
    <div style={{ position: 'absolute', inset: 0, background: INK, overflow: 'hidden' }}>
      <style>{STYLE}</style>
      {!feed ? (
        <TwoTruthsEmpty t={t} onBack={onBack} needsReupload={!hasTwoTruthsData(analytics)} />
      ) : (
        <>
          {phase === 'title' && <TitleScene t={t} people={feed.subjects.length} onStart={start} />}
          {phase === 'play' && round && (
            <RoundScene round={round} t={t} picked={picked} reveal={reveal} qNum={qNum} score={score} streak={streak}
              lives={lives} lostPulse={lostPulse} lastGain={lastGain} scorePulse={scorePulse}
              onPick={pick} onContinue={cont} gameOverNext={gameOverNext} />
          )}
          {phase === 'over' && <ScoreScene t={t} hits={hits} score={score} bestStreak={bestStreak} onReplay={start} onBack={onBack} />}
        </>
      )}

      {/* Always-present close button */}
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
