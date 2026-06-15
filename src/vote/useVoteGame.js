// ============================================================
// Shared state machine for Group Court & Hot Takes.
//
// Both modes are pass-the-phone "vote in secret, then the data
// decides" games. This hook owns: player setup, per-round secret
// voting (one juror at a time), scoring against the data's truth,
// and the final leaderboard. The view layer (GroupCourt / HotTakes)
// supplies the themed screens and reads `phase` to pick which one
// to render.
//
// Phases:
//   'setup'    — choose jurors (names)
//   'prompt'   — show the accusation/statement (themed)
//   'passing'  — "hand the phone to {juror}" interstitial
//   'voting'   — current juror picks in secret
//   'suspense' — all jurors locked, dramatic pause
//   'reveal'   — evidence + verdict (themed)
//   'reaction' — per-juror right/wrong + running scores
//   'final'    — leaderboard
// ============================================================
import { useState, useCallback, useMemo } from 'react';

const SOLO_PLAYER = '__solo__';

export function useVoteGame(rounds, { analytics, onFinish } = {}) {
  const total = rounds.length;

  const [phase, setPhase] = useState('setup');
  const [players, setPlayers] = useState([]); // array of names; [] until setup confirmed
  const [roundIdx, setRoundIdx] = useState(0);
  const [voterIdx, setVoterIdx] = useState(0);
  const [votes, setVotes] = useState({}); // { playerName: pick } for current round
  const [scores, setScores] = useState({}); // { playerName: correctCount }
  const [allVotes, setAllVotes] = useState([]); // history: [{ roundId, votes }]

  const isSolo = players.length === 1 && players[0] === SOLO_PLAYER;
  const round = rounds[roundIdx] || null;

  // ── Setup ────────────────────────────────────────────────────
  const startWithPlayers = useCallback((names) => {
    const cleaned = names.map(n => String(n || '').trim()).filter(Boolean);
    const list = cleaned.length ? cleaned : [SOLO_PLAYER];
    setPlayers(list);
    const initScores = {};
    for (const p of list) initScores[p] = 0;
    setScores(initScores);
    setRoundIdx(0);
    setVoterIdx(0);
    setVotes({});
    setAllVotes([]);
    setPhase(total ? 'prompt' : 'final');
  }, [total]);

  const startSolo = useCallback(() => startWithPlayers([SOLO_PLAYER]), [startWithPlayers]);

  // ── Round flow ───────────────────────────────────────────────
  // From 'prompt' → either go straight to voting (solo) or to the
  // pass-the-phone interstitial for the first juror.
  const beginVoting = useCallback(() => {
    setVoterIdx(0);
    setVotes({});
    setPhase(isSolo ? 'voting' : 'passing');
  }, [isSolo]);

  // Pass-the-phone interstitial → reveal this juror's voting screen.
  const confirmVoter = useCallback(() => setPhase('voting'), []);

  // A juror locks in their secret pick.
  const castVote = useCallback((pick) => {
    const player = players[voterIdx];
    setVotes(v => ({ ...v, [player]: pick }));
    const isLast = voterIdx >= players.length - 1;
    if (isLast) {
      setPhase('suspense');
    } else {
      setVoterIdx(i => i + 1);
      setPhase(isSolo ? 'voting' : 'passing');
    }
  }, [players, voterIdx, isSolo]);

  // Suspense → reveal. Scores the round's votes against `round.truth`.
  const showReveal = useCallback(() => {
    setScores(prev => {
      const next = { ...prev };
      for (const p of players) {
        if (votes[p] === round?.truth) next[p] = (next[p] || 0) + 1;
      }
      return next;
    });
    setAllVotes(prev => [...prev, { roundId: round?.id, votes: { ...votes } }]);
    setPhase('reveal');
  }, [players, votes, round]);

  // Reveal → reaction (per-juror right/wrong recap).
  const showReaction = useCallback(() => setPhase('reaction'), []);

  // Reaction → next round, or final scoreboard.
  const nextRound = useCallback(() => {
    if (roundIdx + 1 < total) {
      setRoundIdx(i => i + 1);
      setVoterIdx(0);
      setVotes({});
      setPhase('prompt');
    } else {
      setPhase('final');
      if (onFinish) {
        const ranked = players
          .map(p => ({ name: p, score: scores[p] || 0 }))
          .sort((a, b) => b.score - a.score);
        onFinish({ ranked, total });
      }
    }
  }, [roundIdx, total, players, scores, onFinish]);

  // ── Replay ───────────────────────────────────────────────────
  const replay = useCallback(() => {
    setPhase('setup');
    setPlayers([]);
    setRoundIdx(0);
    setVoterIdx(0);
    setVotes({});
    setScores({});
    setAllVotes([]);
  }, []);

  // Derived: how the current round's votes break down (for reveal screens).
  const voteTally = useMemo(() => {
    const tally = {};
    for (const opt of round?.options || []) tally[opt] = 0;
    for (const p of players) {
      const pick = votes[p];
      if (pick != null) tally[pick] = (tally[pick] || 0) + 1;
    }
    return tally;
  }, [round, players, votes]);

  const currentVoter = players[voterIdx];
  const lastRoundVotes = allVotes[allVotes.length - 1]?.votes || {};

  // Final ranking, sorted by score desc.
  const leaderboard = useMemo(() => {
    return players
      .map(p => ({ name: p, score: scores[p] || 0, total }))
      .sort((a, b) => b.score - a.score);
  }, [players, scores, total]);

  return {
    phase, setPhase,
    players, isSolo, SOLO_PLAYER,
    round, roundIdx, total,
    voterIdx, currentVoter,
    votes, voteTally, lastRoundVotes,
    scores, leaderboard,
    startWithPlayers, startSolo,
    beginVoting, confirmVoter, castVote,
    showReveal, showReaction, nextRound,
    replay,
  };
}
