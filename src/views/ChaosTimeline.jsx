// ============================================================
// ChaosTimeline — "Chaos: The Game"
//
// A complete reimagining of Chaos Mode. It is NO LONGER a passive
// story deck you tap through — it's an interactive guessing game
// that walks you through the year's chaos one beat at a time and
// ASKS you what really happened before revealing the truth.
//
// Each round is a narrative scene built from the deterministic
// `analytics.chaos` payload:
//   • a number guess on a draggable DIAL (messages/minute, days of
//     silence, emoji storms, …) scored by how close you land, OR
//   • a multiple-choice guess on tappable CARDS (when did it blow
//     up? who was the ringleader? how late were you still awake?),
//   • plus a signature "tap the wildest day on your year" beat that
//     uses the seismogram itself as the input.
//
// After every guess the scene RESOLVES: it shows your guess vs. the
// truth, awards points (with streak combos), and — the hallmark of
// Chaos Mode — surfaces the ACTUAL messages from that minute. The
// game climaxes on the single wildest minute of the year, then
// grades you with a "Chaos IQ" and a best-streak recap.
//
// Everything here is a pure function of the chaos payload — option
// ordering uses a seeded shuffle, the dial defaults to the midpoint,
// no Math.random / Date.now. Same chat → same game.
// ============================================================
import { useMemo, useRef, useState, useEffect } from 'react';

// ── Palette ────────────────────────────────────────────────────
const CREAM     = '#FFF6D6';
const PINK      = '#FDE6F1';
const EGGPLANT  = '#4A0E4E';
const PLUM      = '#2a0645';
const CORAL     = '#f06449';
const GOLD      = '#FFD700';
const SKY       = '#00BFFF';
const MAGENTA   = '#FF1867';
const VIOLET    = '#573280';
const MINT      = '#43AA8B';
const ROSE      = '#F94144';
const NAVY      = '#0A192F';
const WHITE     = '#fff5f7';
const MUTED     = 'rgba(74,14,78,0.55)';

// Cinematic dark canvas shared across the game scenes.
const GAME_BG = `
  radial-gradient(120% 80% at 50% -5%, rgba(255,24,103,0.34) 0%, transparent 55%),
  radial-gradient(100% 80% at 0% 105%, rgba(87,50,128,0.55) 0%, transparent 60%),
  radial-gradient(90% 70% at 100% 100%, rgba(0,191,255,0.20) 0%, transparent 55%),
  linear-gradient(180deg, #1a0a3a 0%, #2a0645 58%, #0A192F 100%)`;

// Time-of-day buckets — used for the "when did it blow up" cards and
// to label peaks. Mirrors analytics' peakTitle ranges.
const TOD_BUCKETS = [
  { key: 'late_night', lo: 0,  hi: 4 },
  { key: 'morning',    lo: 5,  hi: 8 },
  { key: 'midmorning', lo: 9,  hi: 11 },
  { key: 'lunch',      lo: 12, hi: 14 },
  { key: 'afternoon',  lo: 15, hi: 17 },
  { key: 'evening',    lo: 18, hi: 21 },
  { key: 'late',       lo: 22, hi: 23 },
];
const todKey = (h) => (TOD_BUCKETS.find(b => h >= b.lo && h <= b.hi) || TOD_BUCKETS[0]).key;

// Author bubble colours (deterministic by appearance order).
const AUTHOR_COLORS = [GOLD, MAGENTA, SKY, MINT, '#FF8C00', '#FF69B4', CORAL, VIOLET];

// ── Pure helpers ───────────────────────────────────────────────
function fill(str, vars) {
  return String(str ?? '').replace(/\{(\w+)\}/g, (_, k) => (vars && k in vars ? vars[k] : `{${k}}`));
}
// All formatting goes through the app's active language, never the
// browser locale — an English UI on an Israeli phone must not get
// Hebrew month names.
function timeLabel(iso, lang) {
  if (!iso) return '';
  const d = new Date(iso);
  const day = d.toLocaleDateString(lang || 'en', { month: 'short', day: 'numeric' });
  const tm = d.toLocaleTimeString(lang || 'en', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${day} · ${tm}`;
}
function dayKeyLabel(dayKey, lang) {
  if (!dayKey) return '';
  return new Date(dayKey + 'T00:00:00').toLocaleDateString(lang || 'en', { month: 'short', day: 'numeric', year: 'numeric' });
}
function hourClock(h, lang) {
  const d = new Date(2020, 0, 1, ((h % 24) + 24) % 24, 0, 0);
  return d.toLocaleTimeString(lang || 'en', { hour: '2-digit', minute: '2-digit', hour12: false });
}

// Deterministic shuffle so card order is stable per chat but doesn't
// trivially reveal the answer by position.
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

// Dial upper bound: ~2.2× the truth, rounded to a "nice" step so the
// max isn't a dead giveaway and the midpoint rarely equals the answer.
function niceMax(actual) {
  const raw = actual * 2.2 + 2;
  let step;
  if (raw <= 20) step = 2;
  else if (raw <= 60) step = 5;
  else if (raw <= 150) step = 10;
  else if (raw <= 600) step = 25;
  else step = 50;
  const m = Math.ceil(raw / step) * step;
  return Math.max(m, actual + step);
}

// Find the real message excerpts for a given minute timestamp by
// matching it back to a top-10 peak (peaks carry excerpts; awards
// don't). Returns null when the award minute isn't a top peak.
function excerptsForTs(chaos, iso) {
  if (!iso) return null;
  const key = Math.floor(new Date(iso).getTime() / 60000);
  const p = (chaos.peaks || []).find(pk => Math.floor(new Date(pk.ts).getTime() / 60000) === key);
  return p?.excerpts?.length ? p.excerpts : null;
}

// ── Scoring ────────────────────────────────────────────────────
const BASE = 1000;
function scoreDial(guess, actual, max) {
  const err = Math.abs(guess - actual);
  const acc = Math.max(0, 1 - err / Math.max(1, max));
  const bullseye = err <= Math.max(1, Math.round(max * 0.04));
  const points = bullseye ? BASE : Math.round(BASE * Math.pow(acc, 1.6));
  return { points, acc: bullseye ? 1 : acc, hit: acc >= 0.7 || bullseye, bullseye, err };
}
function scoreTap(guessIdx, actualIdx, count) {
  const err = Math.abs(guessIdx - actualIdx);
  const span = Math.max(1, count * 0.5);
  const acc = Math.max(0, 1 - err / span);
  const bullseye = err === 0;
  const points = bullseye ? BASE : Math.round(BASE * Math.pow(acc, 1.6));
  return { points, acc: bullseye ? 1 : acc, hit: acc >= 0.7 || bullseye, bullseye, err };
}
function scoreCard(picked, correct) {
  const right = picked === correct;
  return { points: right ? BASE : 0, acc: right ? 1 : 0, hit: right, bullseye: false, err: right ? 0 : 1 };
}
function verdict(t, res) {
  if (res.bullseye) return { label: t.cg_bullseye || 'BULLSEYE!', color: GOLD };
  if (res.acc >= 0.85) return { label: t.cg_nailed_it || 'Nailed it!', color: MINT };
  if (res.acc >= 0.6)  return { label: t.cg_close || 'So close!', color: MINT };
  if (res.acc >= 0.3)  return { label: t.cg_not_quite || 'Not quite.', color: CORAL };
  return { label: t.cg_way_off || 'Way off!', color: ROSE };
}
function gradeFor(t, iq) {
  if (iq >= 88) return { title: t.cg_grade_5_title, sub: t.cg_grade_5_sub, color: GOLD };
  if (iq >= 70) return { title: t.cg_grade_4_title, sub: t.cg_grade_4_sub, color: MAGENTA };
  if (iq >= 50) return { title: t.cg_grade_3_title, sub: t.cg_grade_3_sub, color: SKY };
  if (iq >= 30) return { title: t.cg_grade_2_title, sub: t.cg_grade_2_sub, color: CORAL };
  return { title: t.cg_grade_1_title, sub: t.cg_grade_1_sub, color: ROSE };
}

// ── Scene builder ──────────────────────────────────────────────
// Produces the ordered list of question scenes for this chat,
// skipping anything without data and climaxing on the wildest minute.
function buildScenes(chaos, t, lang) {
  if (!chaos) return [];
  const peaks = chaos.peaks || [];
  const awards = chaos.awards || {};
  const seis = chaos.seismogram || [];
  const candidates = [];

  // Tap-the-year — re-bucket to ~44 tappable bars.
  if (seis.length >= 10) {
    const target = 44;
    const stride = Math.max(1, Math.ceil(seis.length / target));
    const bars = [];
    for (let i = 0; i < seis.length; i += stride) {
      let best = seis[i];
      for (let j = i; j < Math.min(i + stride, seis.length); j++) {
        if (seis[j].intensity > best.intensity) best = seis[j];
      }
      bars.push({ intensity: best.intensity, day: best.day, count: best.count });
    }
    let actualIdx = 0;
    for (let i = 1; i < bars.length; i++) if (bars[i].intensity > bars[actualIdx].intensity) actualIdx = i;
    candidates.push({
      id: 'seis', kind: 'tap', bars, actualIdx,
      eyebrow: t.cg_seis_eyebrow, question: t.cg_seis_q,
    });
  }

  // A "warm-up" peak distinct from the finale where possible.
  const warm = peaks[1] || peaks[0];

  // When did it blow up (cards).
  if (warm && typeof warm.hour === 'number') {
    const correct = todKey(warm.hour);
    const others = TOD_BUCKETS.map(b => b.key).filter(k => k !== correct);
    const picks = seededShuffle(others, seedFromStr(warm.ts + 'when')).slice(0, 3);
    const options = seededShuffle([correct, ...picks], seedFromStr(warm.ts + 'whenopt'))
      .map(k => ({ key: k, label: t[`cg_tod_${k}`] || k }));
    candidates.push({
      id: 'when', kind: 'cards', ts: warm.ts, options, correctKey: correct,
      eyebrow: t.cg_when_eyebrow, question: t.cg_when_q,
      reveal: fill(t.cg_when_reveal, { time: timeLabel(warm.ts, lang) }),
      evidence: warm.excerpts,
    });
  }

  // Speed run (dial).
  if (awards.speedRun?.count >= 4) {
    const actual = awards.speedRun.count;
    candidates.push({
      id: 'speed', kind: 'dial', actual, max: niceMax(actual), unit: t.cg_speed_unit, ts: awards.speedRun.ts,
      eyebrow: t.cg_speed_eyebrow, question: t.cg_speed_q,
      reveal: fill(t.cg_speed_reveal, { n: actual }),
      evidence: excerptsForTs(chaos, awards.speedRun.ts),
    });
  }

  // Who was the ringleader (cards) — derived from the shown messages.
  if (warm?.excerpts?.length) {
    const counts = new Map();
    for (const e of warm.excerpts) counts.set(e.author, (counts.get(e.author) || 0) + 1);
    const authors = [...counts.keys()];
    if (authors.length >= 2) {
      let top = authors[0];
      for (const a of authors) if (counts.get(a) > counts.get(top)) top = a;
      let options = seededShuffle(authors, seedFromStr(warm.ts + 'who')).slice(0, 4);
      if (!options.includes(top)) options[0] = top;
      candidates.push({
        id: 'who', kind: 'cards', ts: warm.ts,
        options: options.map(a => ({ key: a, label: a })), correctKey: top,
        eyebrow: t.cg_who_eyebrow, question: t.cg_who_q,
        reveal: fill(t.cg_who_reveal, { name: top, n: counts.get(top) }),
        evidence: warm.excerpts,
      });
    }
  }

  // The big silence (dial, with a narrative intro beat).
  if (awards.deadZone?.days >= 2) {
    const actual = awards.deadZone.days;
    candidates.push({
      id: 'dead', kind: 'dial', actual, max: niceMax(actual), unit: t.cg_dead_unit,
      eyebrow: t.cg_dead_eyebrow, intro: t.cg_dead_intro, question: t.cg_dead_q,
      reveal: fill(t.cg_dead_reveal, { n: actual }),
    });
  }

  // Latest the chat was still raging (cards of clock hours).
  if (awards.latest?.ts) {
    const h = new Date(awards.latest.ts).getHours();
    const pool = [0, 1, 2, 3, 4, 5, 6].filter(x => x !== h);
    const picks = seededShuffle(pool, seedFromStr(awards.latest.ts + 'late')).slice(0, 3);
    const options = seededShuffle([h, ...picks], seedFromStr(awards.latest.ts + 'lateopt'))
      .map(x => ({ key: String(x), label: hourClock(x, lang) }));
    candidates.push({
      id: 'latest', kind: 'cards', ts: awards.latest.ts, options, correctKey: String(h),
      eyebrow: t.cg_latest_eyebrow, question: t.cg_latest_q,
      reveal: fill(t.cg_latest_reveal, { time: hourClock(h, lang) }),
      evidence: excerptsForTs(chaos, awards.latest.ts),
    });
  }

  // Group riot (dial).
  if (awards.groupRiot?.uniqueSenders >= 3) {
    const actual = awards.groupRiot.uniqueSenders;
    candidates.push({
      id: 'riot', kind: 'dial', actual, max: Math.max(actual + 3, niceMax(actual)), unit: t.cg_riot_unit, ts: awards.groupRiot.ts,
      eyebrow: t.cg_riot_eyebrow, question: t.cg_riot_q,
      reveal: fill(t.cg_riot_reveal, { n: actual }),
      evidence: excerptsForTs(chaos, awards.groupRiot.ts),
    });
  }

  // Emoji overload (dial).
  if (awards.loudest?.emojiCount >= 5) {
    const actual = awards.loudest.emojiCount;
    candidates.push({
      id: 'loud', kind: 'dial', actual, max: niceMax(actual), unit: t.cg_loud_unit, ts: awards.loudest.ts,
      eyebrow: t.cg_loud_eyebrow, question: t.cg_loud_q,
      reveal: fill(t.cg_loud_reveal, { n: actual }),
      evidence: excerptsForTs(chaos, awards.loudest.ts),
    });
  }

  // Caps-lock riot (dial).
  if (awards.capsRiot?.capsCount >= 3) {
    const actual = awards.capsRiot.capsCount;
    candidates.push({
      id: 'caps', kind: 'dial', actual, max: Math.max(actual + 3, niceMax(actual)), unit: t.cg_caps_unit, ts: awards.capsRiot.ts,
      eyebrow: t.cg_caps_eyebrow, question: t.cg_caps_q,
      reveal: fill(t.cg_caps_reveal, { n: actual }),
      evidence: excerptsForTs(chaos, awards.capsRiot.ts),
    });
  }

  // Keep the run tight — at most 6 warm-up rounds before the finale.
  const chosen = candidates.slice(0, 6);

  // Grand finale — the single wildest minute, with full evidence.
  if (peaks[0]) {
    const p = peaks[0];
    chosen.push({
      id: 'finale', kind: 'dial', actual: p.count, max: niceMax(p.count), unit: t.cg_finale_unit, ts: p.ts,
      eyebrow: t.cg_finale_eyebrow, intro: t.cg_finale_intro, question: t.cg_finale_q,
      reveal: fill(t.cg_finale_reveal, { n: p.count, ppl: p.uniqueSenders }),
      evidence: p.excerpts, evidenceTitle: t.cg_finale_evidence, isFinale: true,
      meta: [
        `${p.count} ${t.chaos_unit_msgs || 'msgs'}`,
        `${p.uniqueSenders} ${t.chaos_unit_ppl || 'ppl'}`,
        timeLabel(p.ts, lang),
      ],
    });
  }

  return chosen;
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

// WhatsApp-flavoured message bubbles — the payload's real excerpts.
function EvidenceList({ excerpts, t }) {
  if (!excerpts?.length) return null;
  const colorMap = new Map();
  let ci = 0;
  for (const m of excerpts) if (!colorMap.has(m.author)) colorMap.set(m.author, AUTHOR_COLORS[ci++ % AUTHOR_COLORS.length]);
  return (
    <div className="no-sb" style={{ display: 'flex', flexDirection: 'column', gap: 7, overflow: 'hidden' }}>
      {excerpts.slice(0, 5).map((m, i) => {
        const c = colorMap.get(m.author) || CORAL;
        return (
          <div key={i} dir="auto" className="a-fade-up" style={{
            flexShrink: 0,
            background: 'rgba(255,255,255,0.09)',
            backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
            border: '1px solid rgba(255,255,255,0.16)',
            borderInlineStart: `4px solid ${c}`,
            borderRadius: 14, padding: '8px 12px',
            boxShadow: '0 10px 22px -12px rgba(0,0,0,0.5)',
            animationDelay: `${0.1 + i * 0.06}s`,
          }}>
            <div className="fs-mono" style={{ fontSize: 10, fontWeight: 800, color: c, letterSpacing: '0.08em' }}>{m.author}</div>
            <div className="fs-sans" style={{ marginTop: 2, fontSize: 14, fontWeight: 500, lineHeight: 1.35, color: '#fff' }}>
              {m.isVoice ? (t.cg_voice || '🎙️ voice note') : m.hasMedia ? (t.cg_media || '🖼 media') : m.content}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Big draggable dial — native range for free touch + keyboard a11y,
// with a floating value readout and (on reveal) a "truth" tick.
function Dial({ value, max, unit, onChange, reveal, actual }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  const actPct = reveal && actual != null && max > 0 ? Math.min(100, (actual / max) * 100) : null;
  const track = reveal
    ? `linear-gradient(90deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.16) 100%)`
    : `linear-gradient(90deg, ${GOLD} 0%, ${MAGENTA} ${pct}%, rgba(255,255,255,0.14) ${pct}%, rgba(255,255,255,0.14) 100%)`;
  return (
    <div style={{ width: '100%' }}>
      {/* readout */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 10, marginBottom: 6 }}>
        <span className="fs-display" style={{
          fontSize: 'clamp(56px, 17vw, 84px)', fontWeight: 800, fontStyle: 'italic',
          letterSpacing: '-0.05em', lineHeight: 0.9,
          color: reveal ? 'rgba(255,255,255,0.45)' : '#fff',
          textShadow: reveal ? 'none' : `0 6px 26px ${MAGENTA}66`,
        }}>{value}</span>
        {reveal && (
          <span className="fs-display a-pop-in" style={{
            fontSize: 'clamp(56px, 17vw, 84px)', fontWeight: 800, fontStyle: 'italic',
            letterSpacing: '-0.05em', lineHeight: 0.9,
            backgroundImage: `linear-gradient(180deg, #fff 0%, ${GOLD} 90%)`,
            WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', WebkitTextFillColor: 'transparent',
            filter: `drop-shadow(0 8px 22px ${GOLD}66)`,
          }}>{actual}</span>
        )}
      </div>
      <div style={{ position: 'relative', padding: '10px 0' }}>
        <input
          type="range" min={0} max={max} step={1} value={value}
          disabled={reveal}
          onChange={(e) => onChange(Number(e.target.value))}
          className="cg-dial"
          aria-label={unit}
          aria-valuetext={`${value} ${unit || ''}`}
          style={{ background: track }}
        />
        {actPct != null && (
          <div aria-hidden style={{ position: 'absolute', top: 0, bottom: 0, left: `${actPct}%`, width: 0, pointerEvents: 'none' }}>
            <div style={{ position: 'absolute', top: -2, left: -1.5, width: 3, height: 36, borderRadius: 3, background: GOLD, boxShadow: `0 0 12px ${GOLD}` }} />
            <div style={{ position: 'absolute', top: -16, left: '50%', transform: 'translateX(-50%)', fontSize: 13, color: GOLD }}>▾</div>
          </div>
        )}
      </div>
      {unit && (
        <div className="fs-mono" style={{ textAlign: 'center', marginTop: 2, fontSize: 12, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)' }}>
          {unit}
        </div>
      )}
    </div>
  );
}

// Multiple-choice cards (when / who / latest).
function Cards({ options, value, correctKey, reveal, onPick }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: options.length > 2 ? '1fr 1fr' : '1fr', gap: 10 }}>
      {options.map((o) => {
        const selected = value === o.key;
        const isCorrect = reveal && o.key === correctKey;
        const isWrongPick = reveal && selected && o.key !== correctKey;
        let border = '1.5px solid rgba(255,255,255,0.18)';
        let bg = selected ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.07)';
        let glow = selected ? `0 10px 26px -10px ${MAGENTA}` : '0 8px 20px -14px rgba(0,0,0,0.6)';
        if (isCorrect) { border = `2px solid ${MINT}`; bg = `${MINT}26`; glow = `0 10px 28px -8px ${MINT}99`; }
        if (isWrongPick) { border = `2px solid ${ROSE}`; bg = `${ROSE}22`; glow = 'none'; }
        return (
          <button
            key={o.key} type="button" dir="auto"
            onClick={() => !reveal && onPick(o.key)}
            disabled={reveal}
            aria-pressed={!reveal ? selected : undefined}
            className={reveal ? '' : 'press'}
            style={{
              position: 'relative', textAlign: 'start', cursor: reveal ? 'default' : 'pointer',
              padding: '16px 16px', borderRadius: 18, border, background: bg,
              backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', boxShadow: glow,
              color: '#fff', fontFamily: 'inherit', minHeight: 56,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
              transition: 'background 0.2s, border-color 0.2s, box-shadow 0.2s',
            }}>
            <span className="fs-sans" style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.2 }}>{o.label}</span>
            {(isCorrect || isWrongPick) && (
              <span aria-hidden style={{ fontSize: 18, flexShrink: 0 }}>{isCorrect ? '✓' : '✕'}</span>
            )}
            {!reveal && selected && (
              <span aria-hidden style={{ width: 18, height: 18, borderRadius: '50%', flexShrink: 0, background: MAGENTA, boxShadow: `0 0 12px ${MAGENTA}` }} />
            )}
          </button>
        );
      })}
    </div>
  );
}

// Tap-the-year seismogram input.
function SeismogramTap({ bars, value, actualIdx, reveal, onPick, lang, t }) {
  return (
    <div>
      <div style={{
        background: 'rgba(255,255,255,0.06)', borderRadius: 22, padding: '20px 14px 14px',
        border: '1px solid rgba(255,255,255,0.16)', boxShadow: '0 24px 50px -24px rgba(0,0,0,0.6)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 168 }}>
          {bars.map((b, i) => {
            const selected = value === i;
            const isAnswer = reveal && i === actualIdx;
            const h = Math.max(4, Math.round(b.intensity * 162));
            let bg = b.intensity > 0.6
              ? `linear-gradient(180deg, ${GOLD}, ${MAGENTA})`
              : b.intensity > 0.25
                ? `linear-gradient(180deg, ${CORAL}, ${MAGENTA}cc)`
                : b.intensity > 0.04 ? `${GOLD}aa` : 'rgba(255,255,255,0.14)';
            if (reveal && !isAnswer) bg = 'rgba(255,255,255,0.12)';
            if (isAnswer) bg = `linear-gradient(180deg, #fff, ${GOLD})`;
            return (
              <button
                key={i} type="button" aria-label={dayKeyLabel(b.day, lang)}
                onClick={() => !reveal && onPick(i)}
                disabled={reveal}
                aria-pressed={!reveal ? selected : undefined}
                style={{
                  position: 'relative', flex: 1, minWidth: 0, height: '100%',
                  display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                  background: 'transparent', border: 'none', padding: 0,
                  cursor: reveal ? 'default' : 'pointer',
                }}>
                <div style={{
                  width: '100%', height: h, borderRadius: 3, background: bg,
                  boxShadow: isAnswer ? `0 0 14px ${GOLD}, 0 0 28px ${GOLD}` : selected ? `0 0 12px ${MAGENTA}` : 'none',
                  outline: selected && !reveal ? `2px solid ${MAGENTA}` : 'none',
                  outlineOffset: 1,
                  transition: 'background 0.25s, box-shadow 0.2s',
                }} />
                {(selected || isAnswer) && (
                  <div aria-hidden style={{
                    position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)',
                    fontSize: 12, color: isAnswer ? GOLD : MAGENTA,
                  }}>▾</div>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <div className="fs-mono" style={{ textAlign: 'center', marginTop: 12, fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.5)' }}>
        {reveal
          ? dayKeyLabel(bars[actualIdx]?.day, lang)
          : (t.cg_seis_hint || 'Tap a bar to guess')}
      </div>
    </div>
  );
}

// ── Title / cold open ──────────────────────────────────────────
function TitleScene({ t, rounds, days, onStart }) {
  const STORM = ['⚡', '🔥', '💥', '🌪️', '🎤', '🌙'];
  const pos = [
    { top: '8%', left: '8%' }, { top: '12%', right: '10%' },
    { top: '30%', right: '7%' }, { bottom: '30%', left: '7%' },
    { bottom: '18%', right: '12%' }, { top: '44%', left: '46%' },
  ];
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: GAME_BG, color: '#fff',
      display: 'flex', flexDirection: 'column',
      padding: 'calc(env(safe-area-inset-top, 0px) + 64px) 26px calc(env(safe-area-inset-bottom, 0px) + 28px)' }}>
      <FloatingBlobs tint={MAGENTA} />
      {STORM.map((e, i) => (
        <div key={i} className="a-float" aria-hidden style={{ position: 'absolute', ...pos[i], fontSize: 34, animationDelay: `${(i * 0.2) % 1.4}s`, filter: 'drop-shadow(0 6px 10px rgba(0,0,0,0.4))' }}>{e}</div>
      ))}
      <div style={{ position: 'relative', zIndex: 2, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div className="fs-mono a-fade-up" style={{ fontSize: 13, letterSpacing: '0.28em', textTransform: 'uppercase', color: GOLD, fontWeight: 800 }}>
          {t.cg_title_eyebrow || '⚡ CHAOS — THE GAME'}
        </div>
        <div className="fs-display a-fade-up" style={{
          marginTop: 14, fontSize: 'clamp(42px, 12vw, 64px)', fontWeight: 800, fontStyle: 'italic',
          letterSpacing: '-0.045em', lineHeight: 0.96,
          backgroundImage: `linear-gradient(135deg, #fff 0%, ${GOLD} 45%, ${MAGENTA} 100%)`,
          WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', WebkitTextFillColor: 'transparent',
          filter: `drop-shadow(0 8px 24px ${MAGENTA}55)`, animationDelay: '0.08s',
        }}>{t.cg_title_h1 || 'How well do you really know your group?'}</div>
        <div className="fs-sans a-fade-up" style={{ marginTop: 20, fontSize: 16, lineHeight: 1.5, color: 'rgba(255,255,255,0.78)', fontWeight: 500, maxWidth: 340, animationDelay: '0.2s' }}>
          {t.cg_title_sub}
        </div>
        <div className="fs-mono a-fade-up" style={{ marginTop: 18, fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.5)', animationDelay: '0.3s' }}>
          {fill(t.cg_title_meta, { n: rounds, days })}
        </div>
      </div>
      <button onClick={onStart} className="press a-fade-up" style={{
        position: 'relative', zIndex: 2, width: '100%', padding: '18px 24px', borderRadius: 999, border: 'none', cursor: 'pointer',
        background: `linear-gradient(135deg, ${GOLD}, ${CORAL} 60%, ${MAGENTA})`, color: PLUM,
        fontWeight: 800, fontSize: 18, fontFamily: 'inherit',
        boxShadow: `0 12px 30px -8px ${MAGENTA}88, 0 2px 0 rgba(255,255,255,0.4) inset`, animationDelay: '0.42s',
      }}>{t.cg_title_cta || 'Start the game →'}</button>
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
          {t.cg_score_label || 'CHAOS IQ'}
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
            fill(t.cg_score_correct, { hits, total }),
            fill(t.cg_score_best_streak, { n: bestStreak }),
            fill(t.cg_score_points, { n: score.toLocaleString() }),
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
          background: `linear-gradient(135deg, ${GOLD}, ${CORAL})`, color: PLUM, fontWeight: 800, fontSize: 16, fontFamily: 'inherit',
          boxShadow: `0 10px 26px -8px ${CORAL}88`,
        }}>{t.cg_replay || 'Play again'}</button>
        <button onClick={onBack} className="press" style={{
          flex: 1, padding: '16px', borderRadius: 999, cursor: 'pointer',
          background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1.5px solid rgba(255,255,255,0.22)', fontWeight: 800, fontSize: 16, fontFamily: 'inherit',
        }}>{t.cg_done || 'Done'}</button>
      </div>
    </div>
  );
}

function tapRevealText(t, scene, res, lang) {
  const b = scene.bars[scene.actualIdx];
  const head = fill(t.cg_seis_reveal, { date: dayKeyLabel(b?.day, lang), count: b?.count ?? 0 });
  const tail = res.err === 0 ? (t.cg_seis_spoton || '') : fill(t.cg_seis_off_by, { n: res.err });
  return `${head} ${tail}`.trim();
}

// ── Question scene ─────────────────────────────────────────────
function QuestionScene({ scene, t, lang, guess, setGuess, reveal, lastResult, roundNum, roundTotal, score, streak, onLock, onContinue, bodyRef }) {
  const canLock = scene.kind === 'cards' ? guess != null : true;
  const v = reveal ? verdict(t, lastResult) : null;

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: GAME_BG, color: '#fff', display: 'flex', flexDirection: 'column' }}>
      <FloatingBlobs tint={scene.isFinale ? GOLD : MAGENTA} />

      {/* HUD */}
      <div style={{ position: 'relative', zIndex: 3, padding: 'calc(env(safe-area-inset-top, 0px) + 14px) 18px 0' }}>
        <div style={{ display: 'flex', gap: 4, marginBottom: 12, paddingInlineEnd: 44 }}>
          {Array.from({ length: roundTotal }).map((_, i) => (
            <div key={i} style={{ flex: 1, height: 3, borderRadius: 8, background: i < roundNum - 1 ? 'rgba(255,255,255,0.6)' : i === roundNum - 1 ? GOLD : 'rgba(255,255,255,0.16)', transition: 'background 0.3s' }} />
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingInlineEnd: 44 }}>
          <span className="fs-mono" style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase' }}>
            {fill(t.cg_round_of, { n: roundNum, total: roundTotal })}
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
      <div ref={bodyRef} className="no-sb" style={{ position: 'relative', zIndex: 2, flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', padding: '18px 24px 0' }}>
        <div key={scene.id + (reveal ? '-r' : '-a')} className="a-fade-up" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div className="fs-mono" style={{ fontSize: 12, letterSpacing: '0.24em', textTransform: 'uppercase', color: scene.isFinale ? GOLD : MAGENTA, fontWeight: 800 }}>
            {scene.eyebrow}
          </div>

          {!reveal ? (
            <>
              {scene.intro && (
                <div className="fs-serif" style={{ marginTop: 12, fontSize: 18, lineHeight: 1.4, color: 'rgba(255,255,255,0.82)', fontStyle: 'italic' }}>{scene.intro}</div>
              )}
              <div className="fs-display" dir="auto" style={{ marginTop: scene.intro ? 10 : 12, fontSize: 'clamp(24px, 6.6vw, 32px)', fontWeight: 800, lineHeight: 1.12, letterSpacing: '-0.02em', color: '#fff' }}>
                {scene.question}
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '24px 0' }}>
                {scene.kind === 'dial' && (
                  <Dial value={guess ?? 0} max={scene.max} unit={scene.unit} onChange={setGuess} reveal={false} />
                )}
                {scene.kind === 'cards' && (
                  <Cards options={scene.options} value={guess} correctKey={scene.correctKey} reveal={false} onPick={setGuess} />
                )}
                {scene.kind === 'tap' && (
                  <SeismogramTap bars={scene.bars} value={guess} actualIdx={scene.actualIdx} reveal={false} onPick={setGuess} lang={lang} t={t} />
                )}
              </div>
            </>
          ) : (
            <>
              {/* Verdict banner */}
              <div className="a-pop-in" style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <span className="fs-display" style={{ fontSize: 'clamp(26px, 7vw, 34px)', fontWeight: 800, fontStyle: 'italic', color: v.color, letterSpacing: '-0.02em' }}>{v.label}</span>
                <span className="fs-mono" style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>
                  +{Math.round(lastResult.points * lastResult.mult).toLocaleString()}
                  {lastResult.mult > 1 && <span style={{ color: GOLD, marginInlineStart: 6, fontSize: 12 }}>{fill(t.cg_combo, { n: lastResult.streakAfter })}</span>}
                </span>
              </div>

              {/* The reveal */}
              <div className="fs-display a-fade-up" dir="auto" style={{
                marginTop: 14, fontSize: 'clamp(22px, 6vw, 30px)', fontWeight: 800, lineHeight: 1.18, letterSpacing: '-0.02em',
                backgroundImage: `linear-gradient(120deg, #fff 0%, ${scene.isFinale ? GOLD : '#fff'} 100%)`,
                WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', WebkitTextFillColor: 'transparent',
                animationDelay: '0.08s',
              }}>{scene.kind === 'tap' ? tapRevealText(t, scene, lastResult, lang) : scene.reveal}</div>

              {/* Inline visual recap of guess vs truth */}
              <div className="a-fade-up" style={{ marginTop: 16, animationDelay: '0.14s' }}>
                {scene.kind === 'dial' && (
                  <Dial value={guess ?? 0} max={scene.max} unit={scene.unit} onChange={() => {}} reveal actual={scene.actual} />
                )}
                {scene.kind === 'cards' && (
                  <Cards options={scene.options} value={guess} correctKey={scene.correctKey} reveal onPick={() => {}} />
                )}
                {scene.kind === 'tap' && (
                  <SeismogramTap bars={scene.bars} value={guess} actualIdx={scene.actualIdx} reveal onPick={() => {}} lang={lang} t={t} />
                )}
              </div>

              {/* Evidence — the real messages */}
              {scene.evidence?.length > 0 && (
                <div className="a-fade-up" style={{ marginTop: 18, animationDelay: '0.2s' }}>
                  {scene.evidenceTitle && (
                    <div className="fs-mono" style={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', fontWeight: 800, marginBottom: 10 }}>{scene.evidenceTitle}</div>
                  )}
                  {scene.meta && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                      {scene.meta.map((m, i) => (
                        <span key={i} className="fs-mono" style={{ padding: '4px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.16)', fontSize: 10.5, fontWeight: 800, color: 'rgba(255,255,255,0.85)' }}>{m}</span>
                      ))}
                    </div>
                  )}
                  <EvidenceList excerpts={scene.evidence} t={t} />
                </div>
              )}
              <div style={{ flex: 1 }} />
            </>
          )}
        </div>
      </div>

      {/* Footer action */}
      <div style={{ position: 'relative', zIndex: 3, padding: '14px 24px calc(env(safe-area-inset-bottom, 0px) + 18px)' }}>
        {!reveal ? (
          <button onClick={onLock} disabled={!canLock} className="press" style={{
            width: '100%', padding: '17px', borderRadius: 999, border: 'none', cursor: canLock ? 'pointer' : 'not-allowed',
            background: canLock ? `linear-gradient(135deg, ${GOLD}, ${CORAL} 60%, ${MAGENTA})` : 'rgba(255,255,255,0.12)',
            color: canLock ? PLUM : 'rgba(255,255,255,0.4)', fontWeight: 800, fontSize: 17, fontFamily: 'inherit',
            boxShadow: canLock ? `0 12px 28px -8px ${MAGENTA}88` : 'none', transition: 'background 0.2s',
          }}>{t.cg_lock_in || 'Lock it in'}</button>
        ) : (
          <button onClick={onContinue} className="press" style={{
            width: '100%', padding: '17px', borderRadius: 999, border: 'none', cursor: 'pointer',
            background: '#fff', color: PLUM, fontWeight: 800, fontSize: 17, fontFamily: 'inherit',
            boxShadow: '0 12px 28px -10px rgba(255,255,255,0.5)',
          }}>{t.cg_continue || 'Continue →'}</button>
        )}
      </div>
    </div>
  );
}

// ── Main controller ────────────────────────────────────────────
export default function ChaosTimeline({ analytics, t, lang, onBack }) {
  const chaos = analytics?.chaos;
  const scenes = useMemo(() => buildScenes(chaos, t, lang), [chaos, t, lang]);
  const total = scenes.length;

  // step 0 = title, 1..total = questions, total+1 = score.
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState('ask');           // 'ask' | 'reveal'
  const [guess, setGuess] = useState(null);
  const [results, setResults] = useState([]);          // per-question scored results
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [lastResult, setLastResult] = useState(null);
  const bodyRef = useRef(null);

  const defaultGuess = (sc) => {
    if (!sc) return null;
    if (sc.kind === 'dial') return Math.round(sc.max / 2);
    if (sc.kind === 'tap') return Math.floor(sc.bars.length / 2);
    return null; // cards: force a pick
  };

  // Scroll back to top whenever the scene or phase changes.
  useEffect(() => { if (bodyRef.current) bodyRef.current.scrollTop = 0; }, [step, phase]);

  if (!chaos || total === 0) {
    return <ChaosEmpty t={t} onBack={onBack} needsReupload={!chaos} />;
  }

  const start = () => { setStep(1); setPhase('ask'); setGuess(defaultGuess(scenes[0])); };
  const replay = () => {
    setStep(0); setPhase('ask'); setGuess(null);
    setResults([]); setScore(0); setStreak(0); setBestStreak(0); setLastResult(null);
  };

  const lockIn = () => {
    const sc = scenes[step - 1];
    let res;
    if (sc.kind === 'dial') res = scoreDial(guess, sc.actual, sc.max);
    else if (sc.kind === 'tap') res = scoreTap(guess, sc.actualIdx, sc.bars.length);
    else res = scoreCard(guess, sc.correctKey);

    const streakAfter = res.hit ? streak + 1 : 0;
    const mult = res.hit ? Math.min(2, 1 + 0.25 * (streakAfter - 1)) : 1;
    const gained = Math.round(res.points * mult);

    setScore(s => s + gained);
    setStreak(streakAfter);
    setBestStreak(b => Math.max(b, streakAfter));
    setResults(r => [...r, { acc: res.acc, hit: res.hit, points: gained }]);
    setLastResult({ ...res, mult, streakAfter });
    setPhase('reveal');
  };

  const next = () => {
    if (step < total) { setStep(step + 1); setPhase('ask'); setGuess(defaultGuess(scenes[step])); }
    else { setStep(total + 1); }
  };

  // Title.
  if (step === 0) {
    return (
      <GameRoot onBack={onBack} t={t}>
        <TitleScene t={t} rounds={total} days={chaos.totalDays || (chaos.seismogram?.length || 0)} onStart={start} />
      </GameRoot>
    );
  }

  // Score / finale.
  if (step > total) {
    const accs = results.map(r => r.acc);
    const iq = accs.length ? Math.round(100 * accs.reduce((a, b) => a + b, 0) / accs.length) : 0;
    const hits = results.filter(r => r.hit).length;
    return (
      <GameRoot onBack={onBack} t={t}>
        <ScoreScene t={t} iq={iq} score={score} hits={hits} total={total} bestStreak={bestStreak} onReplay={replay} onBack={onBack} />
      </GameRoot>
    );
  }

  // Question.
  const sc = scenes[step - 1];
  return (
    <GameRoot onBack={onBack} t={t}>
      <QuestionScene
        scene={sc} t={t} lang={lang}
        guess={guess} setGuess={setGuess}
        reveal={phase === 'reveal'} lastResult={lastResult}
        roundNum={step} roundTotal={total}
        score={score} streak={streak}
        onLock={lockIn} onContinue={next}
        bodyRef={bodyRef}
      />
    </GameRoot>
  );
}

// Shared root: dial CSS + the always-present close button.
function GameRoot({ children, onBack, t }) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: PLUM, overflow: 'hidden' }}>
      <style>{`
        .cg-dial { -webkit-appearance: none; appearance: none; width: 100%; height: 14px; border-radius: 999px; outline: none; cursor: grab; }
        .cg-dial:active { cursor: grabbing; }
        .cg-dial::-webkit-slider-thumb {
          -webkit-appearance: none; appearance: none; width: 40px; height: 40px; border-radius: 50%;
          background: #fff; border: 5px solid ${MAGENTA};
          box-shadow: 0 6px 18px -2px rgba(0,0,0,0.5), 0 0 0 6px rgba(255,24,103,0.18);
          cursor: grab; margin-top: -13px;
        }
        .cg-dial::-moz-range-thumb {
          width: 40px; height: 40px; border-radius: 50%; background: #fff; border: 5px solid ${MAGENTA};
          box-shadow: 0 6px 18px -2px rgba(0,0,0,0.5); cursor: grab;
        }
        .cg-dial::-webkit-slider-runnable-track { height: 14px; border-radius: 999px; }
        .cg-dial::-moz-range-track { height: 14px; border-radius: 999px; }
        .cg-dial:disabled { cursor: default; opacity: 1; }
        .cg-dial:disabled::-webkit-slider-thumb { border-color: rgba(255,255,255,0.5); box-shadow: 0 4px 12px rgba(0,0,0,0.4); cursor: default; }
        .cg-dial:disabled::-moz-range-thumb { border-color: rgba(255,255,255,0.5); cursor: default; }
      `}</style>
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

// ── Empty-state view (kept) ────────────────────────────────────
function ChaosEmpty({ t, onBack, needsReupload }) {
  const title = needsReupload
    ? (t.chaos_empty_old_title || 'Re-upload to unlock')
    : (t.chaos_empty_title || 'No chaos found');
  const body = needsReupload
    ? (t.chaos_empty_old_body || 'This recap was saved before Chaos Mode existed. Re-upload your chat to see the wildest moments.')
    : (t.chaos_empty_body || 'This chat is suspiciously quiet. Try a livelier group.');
  return (
    <div style={{
      position: 'absolute', inset: 0, overflow: 'hidden',
      background: `linear-gradient(180deg, ${CREAM} 0%, #FFF0E2 46%, ${PINK} 100%)`,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '24px', gap: 12, textAlign: 'center',
    }}>
      <div aria-hidden style={{ fontSize: 64 }}>{needsReupload ? '📂' : '🌊'}</div>
      <div className="fs-display" style={{ fontSize: 24, fontWeight: 800, color: PLUM }}>{title}</div>
      <div className="fs-sans" style={{ fontSize: 14, color: MUTED, maxWidth: 300 }}>{body}</div>
      <button onClick={onBack} className="press" style={{
        marginTop: 12, padding: '12px 22px', borderRadius: 999,
        background: `linear-gradient(135deg, ${GOLD}, ${CORAL})`, color: EGGPLANT,
        border: '2px solid rgba(255,255,255,0.8)', cursor: 'pointer', fontWeight: 800, fontSize: 14,
      }}>{t.rm_back || '← Back'}</button>
    </div>
  );
}
