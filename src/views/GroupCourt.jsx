// ============================================================
// Group Court — the group chat is on trial. (Heavy 16-bit pixel-art.)
//
// Pass-the-phone party game: the app reads an accusation, jurors
// secretly vote who's guilty, then a pixel judge SLAMS the gavel to
// deliver the verdict. Every screen lives inside a committed pixel
// courtroom (deep wood + teal wall + stone columns + chibi judge).
//
// Built on the shared src/vote engine (useVoteGame + buildCourtRounds).
// All art is inline SVG (no assets, no network) and left-right
// symmetric so it renders correctly under both LTR and RTL.
// ============================================================
import { useMemo, useState, useEffect } from 'react';
import { useVoteGame } from '../vote/useVoteGame.js';
import { buildCourtRounds } from '../vote/rounds.js';
import { saveBest, loadJurors, saveJurors } from '../vote/storage.js';
import { fill, CloseButton, Avatar } from '../vote/shared.jsx';
import { PixelCourtroom, PixelJudge, PixelScales, PixelPanel, COURT_PX } from './courtPixels.jsx';

const { INK, GOLD, GOLD_HI, GOLD_LO, RED, STONE, WALL } = COURT_PX;
const PARCHMENT = '#F7ECCF';
const PAPER     = '#F3E7CE';
const KRAFT     = '#D9B98A';
const INK_SOFT  = 'rgba(36,23,16,0.66)';

const theme = {
  bg: PARCHMENT, surface: PAPER, surfaceAlt: PAPER, ink: INK, inkMuted: INK_SOFT,
  accent: GOLD, accentInk: INK, shadow: 'rgba(176,126,30,0.5)',
  closeBg: 'rgba(36,23,16,0.55)', closeFg: '#F7ECCF',
};

// ── Heavy courtroom scene: full pixel interior fills the screen, a
//    parchment "spotlight" haze keeps foreground content readable.
//    NO SCROLLING — everything fits one viewport. Content lives in the
//    top region; `action` (a giant button block) dominates the lower
//    ~3/4. The middle area flexes/shrinks so it always fits.
function CourtScene({ children, action = null, judge = null }) {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: WALL, color: INK,
      display: 'flex', flexDirection: 'column' }}>
      <div aria-hidden className="px-crisp" style={{ position: 'absolute', inset: 0 }}>
        <PixelCourtroom />
      </div>
      {/* warm readability haze over the scene */}
      <div aria-hidden style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(120% 70% at 50% 30%, rgba(247,236,207,0.88) 0%, rgba(247,236,207,0.52) 42%, rgba(36,23,16,0.2) 100%)',
      }} />
      <div style={{
        position: 'relative', zIndex: 1, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'flex-start',
        padding: 'calc(env(safe-area-inset-top, 0px) + 50px) 16px 14px',
        gap: 12, textAlign: 'center', overflow: 'hidden',
      }}>
        {judge}
        {children}
      </div>
      {action && (
        <div style={{
          position: 'relative', zIndex: 1, flexShrink: 0,
          padding: '0 14px calc(env(safe-area-inset-bottom, 0px) + 16px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        }}>
          {action}
        </div>
      )}
    </div>
  );
}

// ── GIANT pixel button — the hero action; sized to dominate ~3/4 of
//    the screen height (via `tall`). Hard pixel border + deep press.
function BigPixelButton({ children, onClick, kind = 'gold', disabled, tall = true, style }) {
  const pal = kind === 'gold'
    ? { bg: GOLD, fg: INK, sh: GOLD_LO }
    : { bg: '#EFE0BD', fg: INK, sh: '#B8995F' };
  return (
    <button onClick={onClick} disabled={disabled} className="press fs-pixel" style={{
      width: '100%', maxWidth: 380, height: tall ? '46vh' : 76, minHeight: tall ? 200 : 76,
      maxHeight: tall ? 420 : undefined, padding: '20px 16px',
      cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1,
      background: pal.bg, color: pal.fg, fontSize: tall ? 18 : 13, lineHeight: 1.5,
      border: `5px solid ${INK}`, borderRadius: 0,
      boxShadow: `0 8px 0 0 ${pal.sh}, 0 14px 0 0 ${INK}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
      ...style,
    }}>
      {children}
    </button>
  );
}

function Eyebrow({ children }) {
  return (
    <div className="fs-pixel" style={{ fontSize: 9, color: INK_SOFT, letterSpacing: 0, textTransform: 'uppercase' }}>
      {children}
    </div>
  );
}

// Pixel mugshot frame around an avatar.
function Mugshot({ name, size = 50 }) {
  return (
    <div style={{ padding: 3, border: `3px solid ${INK}`, background: '#fff', display: 'inline-block', boxShadow: `3px 4px 0 0 rgba(36,23,16,0.25)` }}>
      <Avatar name={name} size={size} />
    </div>
  );
}

export default function GroupCourt({ analytics, profile, t, onBack }) {
  const rounds = useMemo(() => buildCourtRounds(analytics), [analytics]);
  const defaultNames = useMemo(() => (analytics?.users || []).slice(0, 4).map(u => u.author), [analytics]);
  const savedJurors = useMemo(() => loadJurors(), []);

  const game = useVoteGame(rounds, {
    analytics,
    onFinish: ({ ranked, total }) => {
      if (ranked.length && ranked[0].name !== game.SOLO_PLAYER) {
        saveBest('court', analytics, { topPlayer: ranked[0].name, score: ranked[0].score, total });
      }
    },
  });

  if (!rounds.length) {
    return (
      <CourtScene
        judge={<PixelJudge size={150} pose="idle" />}
        action={<BigPixelButton onClick={onBack} kind="gold" tall={false}>{t.rm_back || 'Back'}</BigPixelButton>}
      >
        <Eyebrow>{t.gc_court_closed || 'Court is not in session'}</Eyebrow>
        <div className="fs-display" style={{ fontSize: 22, fontWeight: 800 }}>{t.gc_empty_title || 'Not enough evidence for a trial'}</div>
        <div className="fs-sans" style={{ fontSize: 14, color: INK_SOFT, maxWidth: 280 }}>{t.gc_empty_body || 'This chat needs a bit more activity before the court can convene.'}</div>
      </CourtScene>
    );
  }

  const handleStart = (names) => { saveJurors(names); game.startWithPlayers(names); };

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: theme.bg, color: theme.ink }}>
      {game.phase === 'setup' && (
        <JurySetupScreen t={t} defaultNames={defaultNames} savedJurors={savedJurors} onStart={handleStart} onSolo={game.startSolo} />
      )}
      {game.phase === 'prompt' && (
        <CaseFileScreen t={t} round={game.round} roundIdx={game.roundIdx} total={game.total} onContinue={game.beginVoting} />
      )}
      {game.phase === 'passing' && (
        <PassPhoneScreen t={t} name={game.currentVoter} onReady={game.confirmVoter} />
      )}
      {game.phase === 'voting' && (
        <VotingScreen t={t} round={game.round} roundIdx={game.roundIdx} total={game.total} isSolo={game.isSolo} onPick={game.castVote} />
      )}
      {game.phase === 'suspense' && (
        <SuspenseScreen t={t} round={game.round} onContinue={game.showReveal} />
      )}
      {game.phase === 'reveal' && (
        <EvidenceScreen t={t} round={game.round} onContinue={game.showReaction} />
      )}
      {game.phase === 'reaction' && (
        <ReactionScreen t={t} round={game.round} roundIdx={game.roundIdx} total={game.total} players={game.players} votes={game.lastRoundVotes} isSolo={game.isSolo} onContinue={game.nextRound} />
      )}
      {game.phase === 'final' && (
        <FinalVerdictScreen t={t} leaderboard={game.leaderboard} isSolo={game.isSolo} onReplay={game.replay} onBack={onBack} />
      )}

      {game.phase !== 'setup' && <CloseButton onBack={onBack} t={t} theme={theme} />}
    </div>
  );
}

// ── Jury setup (themed) ─────────────────────────────────────────────
function JurySetupScreen({ t, defaultNames, savedJurors, onStart, onSolo }) {
  const initial = (savedJurors && savedJurors.length >= 2) ? savedJurors : (defaultNames || []).slice(0, 4);
  const [names, setNames] = useState(initial.length ? initial : ['', '']);
  const setName = (i, v) => setNames(p => p.map((n, idx) => idx === i ? v : n));
  const add = () => setNames(p => p.length < 8 ? [...p, ''] : p);
  const remove = (i) => setNames(p => p.length > 2 ? p.filter((_, idx) => idx !== i) : p);
  const valid = names.map(n => n.trim()).filter(Boolean);
  const canStart = valid.length >= 2;

  return (
    <CourtScene
      judge={<PixelJudge size={104} pose="idle" />}
      action={
        <>
          <BigPixelButton onClick={() => canStart && onStart(valid)} disabled={!canStart} kind="gold" tall={false}>
            {t.gc_setup_cta || 'Swear in the jury'}
          </BigPixelButton>
          <button onClick={onSolo} className="press fs-pixel" style={{
            width: '100%', maxWidth: 380, padding: '13px', cursor: 'pointer',
            background: 'transparent', color: INK_SOFT, border: `4px solid ${INK}`, borderRadius: 0,
            fontSize: 9, lineHeight: 1.6,
          }}>{t.vote_solo_cta || 'Just me — predict & compare'}</button>
        </>
      }
    >
      <div className="fs-pixel" style={{ fontSize: 15, lineHeight: 1.5 }}>{t.gc_setup_title || 'Swear in the jury'}</div>
      <div className="fs-sans" style={{ fontSize: 13, lineHeight: 1.45, color: INK_SOFT, maxWidth: 300 }}>
        {t.gc_setup_body || 'Add everyone playing. Each juror votes in secret — pass the phone when it’s their turn.'}
      </div>

      {/* The player list is the only flexible region: it shrinks and,
          only if many players are added, scrolls WITHIN itself — the
          page never scrolls. */}
      <div className="no-sb" style={{ marginTop: 4, width: '100%', maxWidth: 360, flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {names.map((name, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <input
              value={name} onChange={e => setName(i, e.target.value)} maxLength={20} dir="auto"
              placeholder={fill(t.vote_player_placeholder || 'Player {n}', { n: i + 1 })}
              style={{
                flex: 1, padding: '13px 16px', fontSize: 15, fontWeight: 700, color: INK,
                border: `4px solid ${INK}`, background: '#FFF8E8', borderRadius: 0,
                fontFamily: 'inherit', outline: 'none', boxShadow: `3px 4px 0 0 rgba(36,23,16,0.18)`,
              }}
            />
            {names.length > 2 && (
              <button onClick={() => remove(i)} className="press fs-pixel" aria-label={t.vote_remove_player || 'Remove'} style={{
                width: 44, height: 46, border: `4px solid ${INK}`, background: KRAFT, color: INK,
                fontSize: 12, cursor: 'pointer', borderRadius: 0, flexShrink: 0,
              }}>×</button>
            )}
          </div>
        ))}
        {names.length < 8 && (
          <button onClick={add} className="press fs-pixel" style={{
            padding: '12px', border: `4px dashed ${INK}`, background: 'transparent', color: INK_SOFT,
            fontSize: 10, lineHeight: 1.5, cursor: 'pointer', borderRadius: 0, flexShrink: 0,
          }}>+ {t.vote_add_player || 'Add player'}</button>
        )}
      </div>
    </CourtScene>
  );
}

// ── Case file reveal: CLASSIFIED bar pixel-wipes off the accusation ──
function CaseFileScreen({ t, round, roundIdx, total, onContinue }) {
  const [open, setOpen] = useState(false);
  const prompt = fill(t[round.promptKey] || round.promptKey, round.promptVars);
  return (
    <CourtScene
      judge={<PixelJudge size={116} pose="idle" />}
      action={<BigPixelButton onClick={onContinue} kind="gold">{t.gc_cast_vote || 'Cast your vote'}</BigPixelButton>}
    >
      <Eyebrow>{fill(t.gc_case_of || 'Case {n} of {total}', { n: roundIdx + 1, total })}</Eyebrow>
      <PixelPanel fill={KRAFT} style={{ width: '100%', maxWidth: 340 }}>
        <div className="fs-pixel" aria-hidden style={{ fontSize: 10, color: 'rgba(36,23,16,0.6)', marginBottom: 14 }}>
          {t.gc_case_file || 'CASE FILE'}
        </div>
        <div style={{ position: 'relative', minHeight: 72 }}>
          <div dir="auto" className="fs-display" style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.35 }}>{prompt}</div>
          {!open && (
            <button className="press" onClick={() => setOpen(true)} style={{
              position: 'absolute', inset: '-4px', background: INK, border: 'none', cursor: 'pointer', padding: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span className="fs-pixel" style={{ color: GOLD, fontSize: 9, lineHeight: 1.6 }}>{t.gc_tap_reveal || 'TAP TO DECLASSIFY'}</span>
            </button>
          )}
          {open && <div aria-hidden className="a-px-wipe" style={{ position: 'absolute', inset: '-4px', background: INK }} />}
        </div>
      </PixelPanel>
    </CourtScene>
  );
}

// ── Voting: pixel mugshot suspect cards ─────────────────────────────
function VotingScreen({ t, round, roundIdx, total, isSolo, onPick }) {
  const [picked, setPicked] = useState(null);
  const prompt = fill(t[round.promptKey] || round.promptKey, round.promptVars);
  const lock = (name) => { if (picked) return; setPicked(name); setTimeout(() => onPick(name), 380); };
  return (
    <CourtScene>
      <Eyebrow>{fill(t.gc_case_of || 'Case {n} of {total}', { n: roundIdx + 1, total })}</Eyebrow>
      <div dir="auto" className="fs-display a-fade-up" style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.3, animationDelay: '0.04s' }}>{prompt}</div>
      <div className="fs-pixel a-fade-up" style={{ fontSize: 9, color: INK_SOFT, lineHeight: 1.6, animationDelay: '0.08s' }}>
        {isSolo ? (t.gc_vote_body_solo || 'Who do you think it is?') : (t.gc_vote_body || 'Pick in secret — no one will see your vote.')}
      </div>
      {/* the suspect cards ARE the action — they fill the screen */}
      <div className="a-fade-up" style={{ marginTop: 10, width: '100%', maxWidth: 380, flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gridAutoRows: '1fr', gap: 12, animationDelay: '0.12s' }}>
        {round.options.map(name => {
          const sel = picked === name;
          return (
            <button key={name} onClick={() => lock(name)} className="press" dir="auto" style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '12px 8px',
              cursor: picked ? 'default' : 'pointer', border: `5px solid ${sel ? GOLD : INK}`,
              background: sel ? '#FBE9C6' : '#FFF8E8', color: INK, fontFamily: 'inherit', position: 'relative', borderRadius: 0,
              boxShadow: `0 7px 0 0 ${sel ? GOLD_LO : 'rgba(36,23,16,0.3)'}`,
              opacity: picked && !sel ? 0.42 : 1, transition: 'opacity 0.2s, border-color 0.2s, background 0.2s',
            }}>
              <Mugshot name={name} size={56} />
              <div className="fs-sans" style={{ fontWeight: 800, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{name}</div>
              {sel && <div aria-hidden className="a-px-stamp fs-pixel" style={{ position: 'absolute', top: 4, insetInlineEnd: 4, padding: '3px 5px', background: GOLD, color: INK, fontSize: 8, border: `3px solid ${INK}` }}>✓</div>}
            </button>
          );
        })}
      </div>
    </CourtScene>
  );
}

// ── Pass-the-phone (themed) ─────────────────────────────────────────
function PassPhoneScreen({ t, name, onReady }) {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: INK, color: '#F7ECCF',
      display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: '54px 18px 8px', textAlign: 'center' }}>
        <PixelScales size={72} />
        <div className="fs-pixel" style={{ fontSize: 10, color: GOLD, lineHeight: 1.6 }}>{t.vote_pass_eyebrow || 'PASS THE PHONE TO'}</div>
        <div dir="auto" className="fs-display" style={{ fontSize: 'clamp(34px, 11vw, 52px)', fontWeight: 800, letterSpacing: '-0.02em' }}>{name}</div>
        <div className="fs-sans" style={{ fontSize: 14, color: 'rgba(247,236,207,0.7)', maxWidth: 280 }}>{t.vote_pass_body || 'Everyone else look away — your vote is secret.'}</div>
      </div>
      <div style={{ flexShrink: 0, width: '100%', display: 'flex', justifyContent: 'center', padding: '0 14px calc(env(safe-area-inset-bottom, 0px) + 16px)' }}>
        <button onClick={onReady} className="press fs-pixel" style={{
          width: '100%', maxWidth: 380, height: '42vh', minHeight: 180, maxHeight: 380, padding: '20px 16px', cursor: 'pointer',
          background: GOLD, color: INK, fontSize: 16, lineHeight: 1.5, border: `5px solid #F7ECCF`, borderRadius: 0,
          boxShadow: `0 8px 0 0 ${GOLD_LO}`, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
        }}>{fill(t.vote_pass_cta || "I'm {name} — let's go", { name })}</button>
      </div>
    </div>
  );
}

// ── Suspense: judge raises gavel, spotlight breathes ────────────────
function SuspenseScreen({ t, round, onContinue }) {
  const long = round.rarity === 'plot_twist';
  const [armed, setArmed] = useState(false);
  useEffect(() => { const id = setTimeout(() => setArmed(true), long ? 1100 : 500); return () => clearTimeout(id); }, [long]);
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: INK, color: '#F7ECCF',
      display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div aria-hidden className="a-px-blink" style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 38%, rgba(232,179,58,0.38) 0%, transparent 56%)' }} />
      <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '54px 18px 8px', textAlign: 'center' }}>
        <PixelJudge size={172} pose="raise" />
        <div className="fs-pixel a-fade-up" style={{ fontSize: 12, lineHeight: 1.7, animationDelay: '0.1s', maxWidth: 300 }}>{t.gc_deliberating || 'The jury has reached a verdict…'}</div>
      </div>
      <div style={{ position: 'relative', flexShrink: 0, width: '100%', display: 'flex', justifyContent: 'center', padding: '0 14px calc(env(safe-area-inset-bottom, 0px) + 16px)' }}>
        <button onClick={onContinue} className="press fs-pixel" style={{
          width: '100%', maxWidth: 380, height: '40vh', minHeight: 170, maxHeight: 360, padding: '20px 16px', cursor: 'pointer',
          background: GOLD, color: INK, fontSize: 16, lineHeight: 1.5, border: `5px solid #F7ECCF`, borderRadius: 0,
          boxShadow: `0 8px 0 0 ${GOLD_LO}`, opacity: armed ? 1 : 0.35, transition: 'opacity 0.3s',
          display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
        }}>{t.gc_reveal_verdict || 'Reveal the verdict'}</button>
      </div>
    </div>
  );
}

// ── Evidence reveal: EXHIBIT A panel, count-up, quote ───────────────
function EvidenceScreen({ t, round, onContinue }) {
  const ev = round.evidence;
  const value = ev.unit === 'minutes' ? Math.round(ev.value * 10) / 10 : Math.round(ev.value);
  const unitLabel = (t[`gc_unit_${ev.unit}`] || ev.unit);
  const evidenceLine = fill(t[ev.metricKey] || ev.metricKey, { ...ev.evidenceVars, name: round.truth });
  return (
    <CourtScene action={<BigPixelButton onClick={onContinue} kind="gold" tall={false}>{t.gc_continue || 'Continue'}</BigPixelButton>}>
      <Eyebrow>{t.gc_exhibit_a || 'EXHIBIT A'}</Eyebrow>
      <PixelPanel fill={PAPER} className="a-pop-in" style={{ width: '100%', maxWidth: 340 }}>
        <Mugshot name={round.truth} size={54} />
        <div dir="auto" className="fs-sans" style={{ fontWeight: 800, fontSize: 15, marginTop: 10 }}>{round.truth}</div>
        <div className="fs-pixel a-spring" style={{ fontSize: 'clamp(28px, 11vw, 42px)', marginTop: 14, color: GOLD_LO, lineHeight: 1.1, animationDelay: '0.1s' }}>{value.toLocaleString()}</div>
        <div className="fs-sans" style={{ fontSize: 13, color: INK_SOFT, marginTop: 6 }}>{unitLabel}</div>
        <div dir="auto" className="fs-sans a-fade-up" style={{ fontSize: 14, marginTop: 12, lineHeight: 1.5, animationDelay: '0.16s' }}>{evidenceLine}</div>
      </PixelPanel>
      {ev.quote && (
        <div dir="auto" className="fs-serif a-fade-up" style={{
          width: '100%', maxWidth: 320, padding: '12px 16px', background: '#fff', border: `4px solid ${INK}`,
          color: INK, fontSize: 14, fontStyle: 'italic', lineHeight: 1.5, animationDelay: '0.22s', boxShadow: '4px 6px 0 0 rgba(36,23,16,0.2)',
        }}>“{ev.quote}”</div>
      )}
    </CourtScene>
  );
}

// ── Reaction: gavel SLAM, GUILTY stamp, dust, per-juror chips ───────
function ReactionScreen({ t, round, roundIdx, total, players, votes, isSolo, onContinue }) {
  const isLast = roundIdx + 1 >= total;
  const isPlotTwist = round.rarity === 'plot_twist';
  const correctCount = players.filter(p => votes[p] === round.truth).length;
  const [slammed, setSlammed] = useState(false);
  useEffect(() => { const id = setTimeout(() => setSlammed(true), 480); return () => clearTimeout(id); }, []);
  return (
    <CourtScene action={<BigPixelButton onClick={onContinue} kind="gold" tall={!isSolo ? false : true}>{isLast ? (t.gc_see_verdict || 'See final verdict') : (t.gc_next_case || 'Next case')}</BigPixelButton>}>
      {isPlotTwist && <div className="fs-pixel a-px-stamp" style={{ fontSize: 15, color: RED, lineHeight: 1.4, transform: 'rotate(-3deg)' }}>{t.gc_objection || 'OBJECTION!'}</div>}
      <div style={{ position: 'relative' }}>
        <PixelJudge size={120} pose="slam" />
        {slammed && <div aria-hidden className="a-px-dust" style={{ position: 'absolute', bottom: '20%', insetInlineEnd: '6%', width: 28, height: 28, borderRadius: '50%', background: 'rgba(36,23,16,0.2)' }} />}
      </div>
      <div aria-hidden className="a-px-stamp fs-pixel" style={{ padding: '10px 16px', background: GOLD, color: INK, fontSize: 15, lineHeight: 1.3, border: `5px solid ${INK}`, transform: 'rotate(-6deg)', boxShadow: `0 7px 0 0 ${GOLD_LO}` }}>{t.gc_guilty || 'GUILTY'}</div>
      <Mugshot name={round.truth} size={48} />
      <div dir="auto" className="fs-display a-fade-up" style={{ fontSize: 19, fontWeight: 800, animationDelay: '0.12s' }}>{round.truth}</div>
      {!isSolo && (
        <div className="fs-sans a-fade-up" style={{ fontSize: 13, color: INK_SOFT, animationDelay: '0.18s' }}>
          {fill(t.gc_jury_said || '{n} of {total} jurors got it right', { n: correctCount, total: players.length })}
        </div>
      )}
      {!isSolo && (
        <div className="no-sb a-fade-up" style={{ width: '100%', maxWidth: 340, flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, animationDelay: '0.22s' }}>
          {players.map(p => {
            const right = votes[p] === round.truth;
            return (
              <div key={p} dir="auto" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: PAPER, border: `3px solid ${INK}`, fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'start' }}>{p}</span>
                <span aria-hidden className="fs-pixel" style={{ fontSize: 9, color: right ? '#3f8f4f' : RED }}>{right ? (t.gc_chip_right || 'RIGHT') : (t.gc_chip_wrong || 'WRONG')}</span>
              </div>
            );
          })}
        </div>
      )}
      {isSolo && <div className="fs-sans a-fade-up" style={{ fontSize: 14, color: INK_SOFT, animationDelay: '0.18s' }}>{correctCount > 0 ? (t.gc_solo_right || 'You called it!') : (t.gc_solo_wrong || 'The data disagrees.')}</div>}
    </CourtScene>
  );
}

// ── Final verdict / leaderboard (themed) ────────────────────────────
function FinalVerdictScreen({ t, leaderboard, isSolo, onReplay, onBack }) {
  if (isSolo) {
    const me = leaderboard[0];
    const pct = me.total ? Math.round((me.score / me.total) * 100) : 0;
    return (
      <CourtScene
        judge={<PixelJudge size={132} pose="idle" />}
        action={
          <>
            <BigPixelButton onClick={onReplay} kind="gold" tall={false}>{t.vote_replay || 'Play again'}</BigPixelButton>
            <button onClick={onBack} className="press fs-pixel" style={{ width: '100%', maxWidth: 380, padding: '13px', cursor: 'pointer', background: 'transparent', color: INK_SOFT, border: `4px solid ${INK}`, borderRadius: 0, fontSize: 10, lineHeight: 1.5 }}>{t.vote_done || 'Done'}</button>
          </>
        }
      >
        <Eyebrow>{t.gc_solo_title || 'Cases cracked'}</Eyebrow>
        <div className="fs-pixel a-spring" style={{ fontSize: 'clamp(40px, 15vw, 60px)', lineHeight: 1.1, color: GOLD_LO }}>{me.score}/{me.total}</div>
        <div className="fs-sans" style={{ fontSize: 15, color: INK_SOFT }}>{fill(t.vote_solo_pct || 'You matched the data {pct}% of the time', { pct })}</div>
      </CourtScene>
    );
  }
  const winner = leaderboard[0];
  const medals = ['1ST', '2ND', '3RD'];
  return (
    <CourtScene
      judge={<PixelJudge size={96} pose="idle" />}
      action={
        <>
          <BigPixelButton onClick={onReplay} kind="gold" tall={false}>{t.vote_replay || 'Play again'}</BigPixelButton>
          <button onClick={onBack} className="press fs-pixel" style={{ width: '100%', maxWidth: 380, padding: '13px', cursor: 'pointer', background: 'transparent', color: INK_SOFT, border: `4px solid ${INK}`, borderRadius: 0, fontSize: 10, lineHeight: 1.5 }}>{t.vote_done || 'Done'}</button>
        </>
      }
    >
      <Eyebrow>{t.gc_court_adjourned || 'Court adjourned'}</Eyebrow>
      <div className="fs-display" style={{ fontSize: 'clamp(20px, 6vw, 28px)', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.15 }}>{fill(t.gc_final_title || '{name} knows the group best', { name: winner?.name || '' })}</div>
      <div className="no-sb" style={{ marginTop: 4, width: '100%', maxWidth: 360, flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {leaderboard.map((row, i) => (
          <div key={row.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', border: `4px solid ${INK}`, background: i === 0 ? GOLD : PAPER, color: INK, boxShadow: i === 0 ? `0 6px 0 0 ${GOLD_LO}` : 'none', flexShrink: 0 }}>
            <div className="fs-pixel" style={{ fontSize: 9, width: 32, textAlign: 'center', flexShrink: 0 }}>{medals[i] || `#${i + 1}`}</div>
            <Mugshot name={row.name} size={32} />
            <div dir="auto" className="fs-sans" style={{ flex: 1, fontWeight: 800, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'start' }}>{row.name}</div>
            <div className="fs-pixel" style={{ fontSize: 10 }}>{row.score}/{row.total}</div>
          </div>
        ))}
      </div>
    </CourtScene>
  );
}
