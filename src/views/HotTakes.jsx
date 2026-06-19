// ============================================================
// Hot Takes — the data fact-checks your group's opinions. (Heavy fight-night.)
//
// Pass-the-phone party game: the app announces a "main event" take,
// jurors square off and secretly vote Agree (red corner) / Disagree
// (blue corner), an audience scorecard reveals the room's split, then
// the data lands a KO with a fact-check stamp
// (TRUE / MISLEADING / IT'S COMPLICATED). Every screen lives inside a
// committed boxing arena (spotlit ring, ropes, corner posts, crowd).
//
// Built on the shared src/vote engine (useVoteGame + buildHotTakeRounds).
// Layouts mirror cleanly under RTL.
// ============================================================
import { useMemo, useState, useEffect } from 'react';
import { useVoteGame } from '../vote/useVoteGame.js';
import { buildHotTakeRounds } from '../vote/rounds.js';
import { saveBest, loadJurors, saveJurors } from '../vote/storage.js';
import { fill, CloseButton, Avatar } from '../vote/shared.jsx';
import { FightArena, Glove, RingBell, TaleOfTape, BOX } from './boxingBits.jsx';

const { CROWD, CROWD2, OFFWHITE, RED, BLUE, FLAME, GOLD } = BOX;
const INK_MUTED = 'rgba(247,241,232,0.62)';

const theme = {
  bg: CROWD, surface: CROWD2, surfaceAlt: CROWD2, ink: OFFWHITE, inkMuted: INK_MUTED,
  accent: FLAME, accentInk: '#141017', shadow: 'rgba(242,98,46,0.5)',
  closeBg: 'rgba(247,241,232,0.14)', closeFg: OFFWHITE,
};

const VERDICT_LABEL = { true: 'ht_verdict_true', misleading: 'ht_verdict_misleading', complicated: 'ht_verdict_complicated' };

// Shared arena wrapper: the ring backdrop behind every screen.
// NO SCROLLING — fits one viewport. Content sits in the top region;
// `action` (a giant button block) dominates the lower ~3/4.
function Arena({ children, action = null, sweep = false, dim = false }) {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: CROWD, color: OFFWHITE,
      display: 'flex', flexDirection: 'column' }}>
      <FightArena sweep={sweep} dim={dim} />
      <div style={{
        position: 'relative', zIndex: 1, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'flex-start',
        padding: 'calc(env(safe-area-inset-top, 0px) + 50px) 16px 12px',
        gap: 12, textAlign: 'center', overflow: 'hidden',
      }}>
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

// GIANT fight-poster CTA — sized to dominate ~3/4 of the screen (tall).
function BigFightButton({ children, onClick, kind = 'flame', disabled, tall = true, style }) {
  const flame = kind === 'flame';
  return (
    <button onClick={onClick} disabled={disabled} className="press fs-boxing" style={{
      width: '100%', maxWidth: 380, height: tall ? '46vh' : 72, minHeight: tall ? 200 : 72,
      maxHeight: tall ? 420 : undefined, padding: '20px 16px',
      cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.45 : 1,
      background: flame ? FLAME : 'transparent', color: flame ? '#141017' : OFFWHITE,
      fontSize: tall ? 30 : 24, letterSpacing: '0.04em', textTransform: 'uppercase',
      border: flame ? 'none' : `3px solid rgba(247,241,232,0.4)`, borderRadius: 16,
      boxShadow: flame ? `0 12px 30px -8px ${theme.shadow}, 0 0 0 3px rgba(242,98,46,0.25)` : 'none',
      display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
      ...style,
    }}>{children}</button>
  );
}

function Eyebrow({ children, color = INK_MUTED, anim = 'a-fade-up' }) {
  return <div className={`fs-boxing ${anim}`} style={{ fontSize: 14, letterSpacing: '0.18em', textTransform: 'uppercase', color }}>{children}</div>;
}

export default function HotTakes({ analytics, profile, t, onBack }) {
  const rounds = useMemo(() => buildHotTakeRounds(analytics, profile?.relationship || 'other'), [analytics, profile]);
  const defaultNames = useMemo(() => (analytics?.users || []).map(u => u.author), [analytics]);
  const savedJurors = useMemo(() => loadJurors(), []);

  const game = useVoteGame(rounds, {
    analytics,
    onFinish: ({ ranked, total }) => {
      if (ranked.length && ranked[0].name !== game.SOLO_PLAYER) {
        saveBest('hottake', analytics, { topPlayer: ranked[0].name, score: ranked[0].score, total });
      }
    },
  });

  if (!rounds.length) {
    return (
      <Arena action={<BigFightButton onClick={onBack} kind="flame" tall={false}>{t.rm_back || 'Back'}</BigFightButton>}>
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <Glove size={72} color={FLAME} />
          <Eyebrow color={FLAME}>{t.ht_no_contest || 'No contest'}</Eyebrow>
          <div className="fs-display" style={{ fontSize: 22, fontWeight: 800 }}>{t.ht_empty_title || 'Not enough heat yet'}</div>
          <div className="fs-sans" style={{ fontSize: 14, color: INK_MUTED, maxWidth: 280 }}>{t.ht_empty_body || 'This chat needs a bit more activity before the fight can start.'}</div>
        </div>
      </Arena>
    );
  }

  const handleStart = (names) => { saveJurors(names); game.startWithPlayers(names); };

  // Instructions show on every entry, before setup.
  const [intro, setIntro] = useState(true);

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: theme.bg, color: theme.ink }}>
      {game.phase === 'setup' && intro && (
        <HowItWorksScreen t={t} onContinue={() => setIntro(false)} />
      )}
      {game.phase === 'setup' && !intro && (
        <FighterSetupScreen t={t} defaultNames={defaultNames} savedJurors={savedJurors} onStart={handleStart} onSolo={game.startSolo} />
      )}
      {game.phase === 'prompt' && (
        <StatementScreen t={t} round={game.round} roundIdx={game.roundIdx} total={game.total} onContinue={game.beginVoting} />
      )}
      {game.phase === 'passing' && (
        <PassPhoneScreen t={t} name={game.currentVoter} onReady={game.confirmVoter} />
      )}
      {game.phase === 'voting' && (
        <VotingScreen t={t} round={game.round} roundIdx={game.roundIdx} total={game.total} isSolo={game.isSolo} onPick={game.castVote} />
      )}
      {game.phase === 'suspense' && (
        <ScorecardScreen t={t} round={game.round} players={game.players} votes={game.votes} isSolo={game.isSolo} onContinue={game.showReveal} />
      )}
      {game.phase === 'reveal' && (
        <FactCheckScreen t={t} round={game.round} onContinue={game.showReaction} />
      )}
      {game.phase === 'reaction' && (
        <ReactionScreen t={t} round={game.round} roundIdx={game.roundIdx} total={game.total} players={game.players} votes={game.lastRoundVotes} isSolo={game.isSolo} onContinue={game.nextRound} />
      )}
      {game.phase === 'final' && (
        <FinalScorecardScreen t={t} leaderboard={game.leaderboard} isSolo={game.isSolo} onReplay={game.replay} onBack={onBack} />
      )}

      {game.phase !== 'setup' && <CloseButton onBack={onBack} t={t} theme={theme} />}
    </div>
  );
}

// ── How it works (shown on every entry) ─────────────────────────────
function HowItWorksScreen({ t, onContinue }) {
  const steps = [
    { glove: RED, t: t.ht_how_1_t || 'Hear the take', b: t.ht_how_1_b || 'A spicy claim about someone in the group drops in.' },
    { glove: BLUE, t: t.ht_how_2_t || 'Pick a corner', b: t.ht_how_2_b || 'Everyone secretly votes Agree (red) or Disagree (blue).' },
    { glove: GOLD, t: t.ht_how_3_t || 'The data decides', b: t.ht_how_3_b || 'The receipts land a verdict.' },
  ];
  return (
    <Arena action={<BigFightButton onClick={onContinue} kind="flame" tall={false}>{t.ht_how_cta || 'Ring the bell'}</BigFightButton>}>
      <Eyebrow color={FLAME}>{t.ht_how_eyebrow || 'How the fight works'}</Eyebrow>
      <div className="fs-boxing" style={{ fontSize: 26, letterSpacing: '0.02em', textTransform: 'uppercase' }}>{t.ht_how_title || 'Tonight’s main event'}</div>
      <div style={{ width: '100%', maxWidth: 340, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12 }}>
        {steps.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'start', background: CROWD2, border: `2px solid rgba(247,241,232,0.12)`, borderRadius: 14, padding: '12px 14px' }}>
            <div style={{ flexShrink: 0 }}><Glove size={36} color={s.glove} /></div>
            <div style={{ minWidth: 0 }}>
              <div className="fs-boxing" style={{ fontSize: 16, letterSpacing: '0.02em' }}>{s.t}</div>
              <div className="fs-sans" style={{ fontSize: 13, lineHeight: 1.4, color: INK_MUTED, marginTop: 2 }}>{s.b}</div>
            </div>
          </div>
        ))}
      </div>
    </Arena>
  );
}

// ── Fighter setup (themed) ──────────────────────────────────────────
function FighterSetupScreen({ t, defaultNames, savedJurors, onStart, onSolo }) {
  // Auto-fill with everyone in the chat. Editing stays fully available.
  const initial = (defaultNames && defaultNames.length >= 2)
    ? defaultNames
    : (savedJurors && savedJurors.length >= 2 ? savedJurors : (defaultNames || []));
  const MAX_PLAYERS = Math.max(8, (defaultNames || []).length);
  const [names, setNames] = useState(initial.length ? initial : ['', '']);
  const setName = (i, v) => setNames(p => p.map((n, idx) => idx === i ? v : n));
  const add = () => setNames(p => p.length < MAX_PLAYERS ? [...p, ''] : p);
  const remove = (i) => setNames(p => p.length > 2 ? p.filter((_, idx) => idx !== i) : p);
  const valid = names.map(n => n.trim()).filter(Boolean);
  const canStart = valid.length >= 2;

  return (
    <Arena
      action={
        <>
          <BigFightButton onClick={() => canStart && onStart(valid)} disabled={!canStart} kind="flame" tall={false}>{t.ht_setup_cta || 'Bring the heat'}</BigFightButton>
          <button onClick={onSolo} className="press fs-boxing" style={{ width: '100%', maxWidth: 380, padding: '13px', cursor: 'pointer', background: 'transparent', color: INK_MUTED, border: '2px solid rgba(247,241,232,0.25)', borderRadius: 14, fontSize: 14, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{t.vote_solo_cta || 'Just me — predict & compare'}</button>
        </>
      }
    >
      <div style={{ display: 'flex', gap: 8 }}><Glove size={36} color={RED} /><Glove size={36} color={BLUE} /></div>
      <div className="fs-boxing" style={{ fontSize: 26, letterSpacing: '0.02em', textTransform: 'uppercase' }}>{t.ht_setup_title || 'Bring the heat'}</div>
      <div className="fs-sans" style={{ fontSize: 13, lineHeight: 1.45, color: INK_MUTED, maxWidth: 300 }}>{t.ht_setup_body || 'Add everyone playing. Each player votes in secret — pass the phone when it’s their turn.'}</div>

      <div className="no-sb" style={{ marginTop: 4, width: '100%', maxWidth: 360, flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {names.map((name, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <input value={name} onChange={e => setName(i, e.target.value)} maxLength={20} dir="auto"
              placeholder={fill(t.vote_player_placeholder || 'Player {n}', { n: i + 1 })}
              style={{ flex: 1, padding: '13px 16px', fontSize: 15, fontWeight: 700, color: OFFWHITE,
                border: `2px solid rgba(247,241,232,0.2)`, background: 'rgba(247,241,232,0.06)', borderRadius: 12,
                fontFamily: 'inherit', outline: 'none' }} />
            {names.length > 2 && (
              <button onClick={() => remove(i)} className="press" aria-label={t.vote_remove_player || 'Remove'} style={{
                width: 46, height: 46, border: '2px solid rgba(247,241,232,0.18)', background: CROWD2, color: INK_MUTED,
                fontSize: 18, fontWeight: 800, cursor: 'pointer', borderRadius: 12, flexShrink: 0 }}>×</button>
            )}
          </div>
        ))}
        {names.length < MAX_PLAYERS && (
          <button onClick={add} className="press fs-boxing" style={{ padding: '12px', border: '2px dashed rgba(247,241,232,0.22)', background: 'transparent', color: INK_MUTED, fontSize: 14, letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: 12, flexShrink: 0 }}>+ {t.vote_add_player || 'Add player'}</button>
        )}
      </div>
    </Arena>
  );
}

function SpiceTape({ level }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {[1, 2, 3].map(i => <span key={i} aria-hidden style={{ opacity: i <= level ? 1 : 0.22, fontSize: 22 }}>🥊</span>)}
    </div>
  );
}

// ── Statement reveal: the take as a "MAIN EVENT" bout poster ────────
function StatementScreen({ t, round, roundIdx, total, onContinue }) {
  const statement = fill(t[round.promptKey] || round.promptKey, round.promptVars);
  const spiceLevel = round.rarity === 'plot_twist' ? 3 : round.verdict === 'complicated' ? 2 : 1;
  const [bell, setBell] = useState(false);
  useEffect(() => { const id = setTimeout(() => setBell(true), 140); return () => clearTimeout(id); }, []);
  return (
    <Arena action={<BigFightButton onClick={onContinue} kind="flame">{t.ht_cast_vote || 'Cast your vote'}</BigFightButton>}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <RingBell size={42} ringing={bell} />
        <Eyebrow color={FLAME}>{fill(t.ht_take_of || 'Take {n} of {total}', { n: roundIdx + 1, total })}</Eyebrow>
      </div>
      <div className="fs-boxing" style={{ fontSize: 16, letterSpacing: '0.24em', color: INK_MUTED, textTransform: 'uppercase' }}>{t.ht_main_event || 'Main Event'}</div>

      <div className="a-roast-card" style={{
        width: '100%', maxWidth: 340, borderRadius: 18, background: CROWD2,
        border: `2px solid rgba(247,241,232,0.12)`, padding: '26px 22px', position: 'relative', overflow: 'hidden',
        boxShadow: '0 20px 44px -14px rgba(0,0,0,0.7)',
      }}>
        <div aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 5, background: `linear-gradient(90deg, ${RED}, ${FLAME}, ${BLUE})` }} />
        <div dir="auto" className="fs-display" style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.3 }}>{statement}</div>
      </div>
      <SpiceTape level={spiceLevel} />
    </Arena>
  );
}

// ── Voting: two corners square off. AGREE = red, DISAGREE = blue. ───
function VotingScreen({ t, round, roundIdx, total, isSolo, onPick }) {
  const [picked, setPicked] = useState(null);
  const statement = fill(t[round.promptKey] || round.promptKey, round.promptVars);
  const lock = (pick) => { if (picked) return; setPicked(pick); setTimeout(() => onPick(pick), 380); };

  const corner = (pick, color, label, anim) => {
    const active = picked === pick;
    return (
      <button onClick={() => lock(pick)} className={`press ${anim}`} style={{
        flex: 1, minWidth: 0, height: '100%', padding: '20px 10px', cursor: picked ? 'default' : 'pointer',
        borderRadius: 20, border: `5px solid ${active ? color : 'rgba(247,241,232,0.16)'}`,
        background: active ? `${color}30` : `linear-gradient(180deg, ${color}1A 0%, ${CROWD2} 60%)`, color: OFFWHITE,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16,
        fontFamily: 'inherit', position: 'relative',
        opacity: picked && !active ? 0.4 : 1, transition: 'opacity 0.22s, border-color 0.22s, background 0.22s',
        boxShadow: active ? `0 0 0 5px ${color}33, 0 16px 36px -10px ${color}99` : `0 10px 28px -12px ${color}66`,
      }}>
        {/* corner-post colour flag */}
        <div aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 8, background: color, borderRadius: '14px 14px 0 0' }} />
        <div style={{ filter: active ? 'none' : 'saturate(0.9)' }}><span style={{ fontSize: 76, lineHeight: 1, display: 'inline-block', transform: pick === 'disagree' ? 'scaleX(-1)' : 'none' }}>🥊</span></div>
        <span className="fs-boxing" style={{ fontSize: 30, letterSpacing: '0.04em' }}>{label}</span>
        {active && <span aria-hidden className="a-ko-punch fs-boxing" style={{ position: 'absolute', top: 14, insetInlineEnd: 14, fontSize: 15, padding: '4px 10px', borderRadius: 6, background: color, color: '#141017' }}>✓</span>}
      </button>
    );
  };

  return (
    <Arena dim>
      <Eyebrow color={FLAME}>{fill(t.ht_take_of || 'Take {n} of {total}', { n: roundIdx + 1, total })}</Eyebrow>
      <div dir="auto" className="fs-display a-fade-up" style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.3, animationDelay: '0.04s' }}>{statement}</div>
      <div className="fs-boxing a-fade-up" style={{ fontSize: 13, letterSpacing: '0.2em', color: INK_MUTED, textTransform: 'uppercase', animationDelay: '0.1s' }}>{t.ht_pick_corner || 'Pick a corner'}</div>

      {/* the two corners ARE the action — they fill ~3/4 of the screen */}
      <div style={{ marginTop: 8, width: '100%', maxWidth: 380, flex: 1, minHeight: 0, display: 'flex', alignItems: 'stretch', gap: 10 }}>
        {corner('agree', RED, t.ht_agree || 'AGREE', 'a-corner-l')}
        <div className="fs-boxing" style={{ display: 'flex', alignItems: 'center', fontSize: 22, color: INK_MUTED, letterSpacing: '0.08em' }}>{t.ht_vs || 'VS'}</div>
        {corner('disagree', BLUE, t.ht_disagree || 'DISAGREE', 'a-corner-r')}
      </div>
    </Arena>
  );
}

// ── Pass-the-phone (themed) ─────────────────────────────────────────
function PassPhoneScreen({ t, name, onReady }) {
  return (
    <Arena dim action={<BigFightButton onClick={onReady} kind="flame" style={{ fontSize: 22 }}>{fill(t.vote_pass_cta || "I'm {name} — let's go", { name })}</BigFightButton>}>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
        <div style={{ display: 'flex', gap: 10 }}><Glove size={48} color={RED} /><Glove size={48} color={BLUE} /></div>
        <Eyebrow color={FLAME}>{t.vote_pass_eyebrow || 'PASS THE PHONE TO'}</Eyebrow>
        <div dir="auto" className="fs-display" style={{ fontSize: 'clamp(34px, 11vw, 52px)', fontWeight: 800, letterSpacing: '-0.02em' }}>{name}</div>
        <div className="fs-sans" style={{ fontSize: 14, color: INK_MUTED, maxWidth: 280 }}>{t.vote_pass_body || 'Everyone else look away — your vote is secret.'}</div>
      </div>
    </Arena>
  );
}

// ── Scorecard: audience tug-of-war + ring bell. ─────────────────────
function ScorecardScreen({ t, round, players, votes, isSolo, onContinue }) {
  const agreeCount = players.filter(p => votes[p] === 'agree').length;
  const disagreeCount = players.length - agreeCount;
  const total = players.length || 1;
  const agreePct = Math.round((agreeCount / total) * 100);
  const isDivided = agreeCount > 0 && disagreeCount > 0;
  const [shown, setShown] = useState(50);
  useEffect(() => { const id = setTimeout(() => setShown(agreePct), 140); return () => clearTimeout(id); }, [agreePct]);

  return (
    <Arena sweep dim action={<BigFightButton onClick={onContinue} kind="flame">{t.ht_fact_check || 'Fact-check it'}</BigFightButton>}>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <RingBell size={56} ringing />
        <div className="fs-boxing a-fade-up" style={{ fontSize: 26, letterSpacing: '0.03em', textTransform: 'uppercase' }}>
          {isSolo ? (t.ht_locked_in || 'Locked in.') : isDivided ? (t.ht_room_divided || 'The room is DIVIDED') : (t.ht_room_united || 'The room is UNITED')}
        </div>
        {!isSolo && (
          <div className="a-fade-up" style={{ width: '100%', maxWidth: 340, animationDelay: '0.1s' }}>
            <div className="fs-boxing" style={{ fontSize: 13, letterSpacing: '0.18em', color: INK_MUTED, textTransform: 'uppercase', marginBottom: 8 }}>{t.ht_audience_card || 'Audience scorecard'}</div>
            <div style={{ display: 'flex', height: 30, borderRadius: 10, overflow: 'hidden', border: '2px solid rgba(247,241,232,0.14)' }}>
              <div style={{ width: `${shown}%`, background: RED, transition: 'width 0.9s cubic-bezier(0.34,1.56,0.64,1)' }} />
              <div style={{ width: `${100 - shown}%`, background: BLUE, transition: 'width 0.9s cubic-bezier(0.34,1.56,0.64,1)' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 14 }}>
              <span className="fs-boxing" style={{ color: RED, letterSpacing: '0.04em' }}>{fill(t.ht_agree_pct || '{pct}% agree', { pct: agreePct })}</span>
              <span className="fs-boxing" style={{ color: BLUE, letterSpacing: '0.04em' }}>{fill(t.ht_disagree_pct || '{pct}% disagree', { pct: 100 - agreePct })}</span>
            </div>
          </div>
        )}
        <div aria-hidden className="a-pulse-glow a-fade-up" style={{ animationDelay: '0.2s' }}><Glove size={58} color={FLAME} /></div>
      </div>
    </Arena>
  );
}

// ── Fact-check: TALE OF THE TAPE plate + KO verdict stamp. ──────────
function FactCheckScreen({ t, round, onContinue }) {
  const ev = round.evidence;
  const value = Math.round(ev.value);
  const evidenceLine = fill(t[ev.metricKey] || ev.metricKey, ev.evidenceVars);
  const verdictLabel = t[VERDICT_LABEL[round.verdict]] || round.verdict;
  const verdictColor = round.verdict === 'true' ? '#6FCF7A' : round.verdict === 'complicated' ? GOLD : FLAME;
  return (
    <Arena dim action={<BigFightButton onClick={onContinue} kind="flame" tall={false}>{t.ht_continue || 'Continue'}</BigFightButton>}>
      <Eyebrow color={INK_MUTED}>{t.ht_the_data_says || 'The data says'}</Eyebrow>
      <TaleOfTape label={t.ht_tale_of_tape || 'Tale of the tape'} value={value.toLocaleString()} unit={null} color={FLAME}
        name={ev.evidenceVars?.name || null} avatar={ev.evidenceVars?.name ? <Avatar name={ev.evidenceVars.name} size={48} /> : null} />
      <div dir="auto" className="fs-sans a-fade-up" style={{ maxWidth: 300, fontSize: 14, lineHeight: 1.5, color: INK_MUTED, animationDelay: '0.16s' }}>{evidenceLine}</div>
      <div aria-hidden className="a-ko-punch fs-boxing" style={{
        marginTop: 2, padding: '14px 30px', borderRadius: 14, fontSize: 26, letterSpacing: '0.05em', color: '#141017',
        background: verdictColor, textTransform: 'uppercase', boxShadow: `0 14px 30px -8px ${verdictColor}99`, border: '3px solid rgba(20,16,23,0.2)',
      }}>{verdictLabel}</div>
      {ev.quote && (
        <div dir="auto" className="fs-serif a-fade-up" style={{ width: '100%', maxWidth: 300, padding: '14px 18px', borderRadius: 14, background: 'rgba(247,241,232,0.05)', color: INK_MUTED, fontSize: 14, fontStyle: 'italic', lineHeight: 1.5, animationDelay: '0.32s' }}>“{ev.quote}”</div>
      )}
    </Arena>
  );
}

// ── Reaction: the judges score it; per-player chips. ────────────────
function ReactionScreen({ t, round, roundIdx, total, players, votes, isSolo, onContinue }) {
  const isLast = roundIdx + 1 >= total;
  const correctCount = players.filter(p => votes[p] === round.truth).length;
  const truthColor = round.truth === 'agree' ? RED : BLUE;
  const truthLabel = round.truth === 'agree' ? (t.ht_agree || 'AGREE') : (t.ht_disagree || 'DISAGREE');
  return (
    <Arena dim action={<BigFightButton onClick={onContinue} kind="flame" tall={isSolo}>{isLast ? (t.ht_see_scoreboard || 'See final scoreboard') : (t.ht_next_take || 'Next take')}</BigFightButton>}>
      <Eyebrow color={INK_MUTED}>{t.ht_data_landed || 'The data lands on:'}</Eyebrow>
      <div className="fs-boxing a-ko-punch" style={{ fontSize: 40, letterSpacing: '0.04em', color: truthColor, textTransform: 'uppercase' }}>{truthLabel}</div>
      {!isSolo && <div className="fs-sans a-fade-up" style={{ fontSize: 14, color: INK_MUTED, animationDelay: '0.18s' }}>{fill(t.ht_matched || '{n} of {total} matched the data', { n: correctCount, total: players.length })}</div>}
      {!isSolo && (
        <div className="no-sb a-fade-up" style={{ width: '100%', maxWidth: 340, flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, animationDelay: '0.22s' }}>
          {players.map(p => {
            const right = votes[p] === round.truth;
            return (
              <div key={p} dir="auto" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 12, background: CROWD2, border: `1.5px solid ${right ? 'rgba(111,207,122,0.4)' : 'rgba(242,98,46,0.3)'}`, fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'start' }}>{p}</span>
                <span aria-hidden className="fs-boxing" style={{ fontSize: 12, letterSpacing: '0.08em', color: right ? '#6FCF7A' : FLAME }}>{right ? (t.ht_chip_right || 'ON THE MONEY') : (t.ht_chip_wrong || 'KO’D')}</span>
              </div>
            );
          })}
        </div>
      )}
      {isSolo && <div className="fs-sans a-fade-up" style={{ fontSize: 14, color: INK_MUTED, animationDelay: '0.18s' }}>{correctCount > 0 ? (t.ht_solo_right || 'Your take checks out.') : (t.ht_solo_wrong || 'The data disagrees with you.')}</div>}
    </Arena>
  );
}

// ── Final scorecard / leaderboard (themed) ──────────────────────────
function FinalScorecardScreen({ t, leaderboard, isSolo, onReplay, onBack }) {
  if (isSolo) {
    const me = leaderboard[0];
    const pct = me.total ? Math.round((me.score / me.total) * 100) : 0;
    return (
      <Arena
        action={
          <>
            <BigFightButton onClick={onReplay} kind="flame" tall={false}>{t.vote_replay || 'Play again'}</BigFightButton>
            <button onClick={onBack} className="press fs-boxing" style={{ width: '100%', maxWidth: 380, padding: '13px', cursor: 'pointer', background: 'transparent', color: INK_MUTED, border: '2px solid rgba(247,241,232,0.25)', borderRadius: 14, fontSize: 14, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{t.vote_done || 'Done'}</button>
          </>
        }
      >
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <Glove size={64} color={FLAME} />
          <Eyebrow color={INK_MUTED}>{t.ht_solo_title || 'Calls that matched the data'}</Eyebrow>
          <div className="fs-boxing a-spring" style={{ fontSize: 'clamp(56px, 20vw, 84px)', lineHeight: 1, color: FLAME }}>{me.score}/{me.total}</div>
          <div className="fs-sans" style={{ fontSize: 15, color: INK_MUTED }}>{fill(t.vote_solo_pct || 'You matched the data {pct}% of the time', { pct })}</div>
        </div>
      </Arena>
    );
  }
  const winner = leaderboard[0];
  const medals = ['1ST', '2ND', '3RD'];
  return (
    <Arena
      action={
        <>
          <BigFightButton onClick={onReplay} kind="flame" tall={false}>{t.vote_replay || 'Play again'}</BigFightButton>
          <button onClick={onBack} className="press fs-boxing" style={{ width: '100%', maxWidth: 380, padding: '13px', cursor: 'pointer', background: 'transparent', color: INK_MUTED, border: '2px solid rgba(247,241,232,0.25)', borderRadius: 14, fontSize: 14, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{t.vote_done || 'Done'}</button>
        </>
      }
    >
      <Glove size={48} color={GOLD} />
      <Eyebrow color={INK_MUTED}>{t.ht_decision || 'And the decision goes to…'}</Eyebrow>
      <div className="fs-display" style={{ fontSize: 'clamp(20px, 6vw, 28px)', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.15 }}>{fill(t.ht_final_title || '{name} has the sharpest take', { name: winner?.name || '' })}</div>
      <div className="no-sb" style={{ marginTop: 4, width: '100%', maxWidth: 360, flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {leaderboard.map((row, i) => (
          <div key={row.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 14, background: i === 0 ? FLAME : CROWD2, color: i === 0 ? '#141017' : OFFWHITE, boxShadow: i === 0 ? `0 10px 26px -8px ${theme.shadow}` : 'none', flexShrink: 0 }}>
            <div className="fs-boxing" style={{ fontSize: 14, width: 36, textAlign: 'center', flexShrink: 0, letterSpacing: '0.04em' }}>{medals[i] || `#${i + 1}`}</div>
            <Avatar name={row.name} size={34} />
            <div dir="auto" className="fs-sans" style={{ flex: 1, fontWeight: 800, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'start' }}>{row.name}</div>
            <div className="fs-boxing" style={{ fontSize: 15 }}>{row.score}/{row.total}</div>
          </div>
        ))}
      </div>
    </Arena>
  );
}
