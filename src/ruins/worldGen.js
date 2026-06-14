// ============================================================
// World generator for The Ruins of [GroupName].
// buildKingdom(analytics, t, lang) is a pure function: districts,
// case placement, monument forms, verdict-slot ANSWERS, echo
// testimony and lead copy are all derived from analytics.chaos.peaks
// / analytics.eras / analytics.userMap / analytics.runningJokes via
// chatSeed — same export, same kingdom, forever. i18n strings are
// pre-resolved here (mirrors ChaosTimeline's buildScenes) so
// RuinsCanvas/CaseScene stay presentational. Returns null when there
// isn't enough chaos data — the caller (RuinsOfGroup) shows the
// empty-state floor instead.
//
// Phase 2: era districts now stack above Gates (one per analytics
// era, up to 3 — higher = deeper into the past), main cases (one per
// chaos peak) round-robin across them via 3 generalized templates,
// and Legendary Figure / Joke Shrine side-cases fill out an 8-12
// case budget.
// ============================================================
import { makeRng, chatSeed } from './rng.js';
import { interp } from '../i18n/index.js';
import { buildFigures, pickFigureCases } from './figures.js';

export const WORLD = { W: 720 };

// ── District stacking geometry ──────────────────────────────
const GATES_H = 480;
const ERA_H = 600;
const GAP = 40;
const HEART_H = 120;

// ── Time-of-day buckets (mirrors ChaosTimeline's TOD_BUCKETS) ──
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

// ── Monument forms — flavor tag driving marker emoji/palette ───
const MONUMENT_EMOJI = {
  scorched: '🔥', bell_tower: '🔔', observatory: '🔭', amphitheater: '🏛️', carnival: '🎪',
};
function monumentForm(peak) {
  if (peak.capsCount >= 3) return 'scorched';
  if (peak.voiceCount >= 2) return 'bell_tower';
  if (peak.hour <= 4) return 'observatory';
  if (peak.uniqueSenders >= 4) return 'amphitheater';
  return 'carnival';
}

// ── District palettes ───────────────────────────────────────
const PALETTE_DAY   = { ground: '#E8D9B5', accent: '#C9A876', glow: '#FFD700' };
const PALETTE_NIGHT = { ground: '#2a2440', accent: '#4d4570', glow: '#9b8cff' };
const PALETTE_MURAL = { ground: '#f3d9e6', accent: '#e08fb0', glow: '#FF69B4' };

// Per-era identity: a nocturnal era gets the night palette, a
// media-heavy era gets the mural palette, otherwise day.
function paletteForEra(era) {
  if (!era) return PALETTE_DAY;
  if (era.nightPct > 35) return PALETTE_NIGHT;
  if (era.mediaPct > 25) return PALETTE_MURAL;
  return PALETTE_DAY;
}

const LANDMARK_EMOJI = {
  gates: ['🏺', '🪵', '🗿', '🌾', '🪨'],
  era:   ['🏛️', '🗼', '⛲', '🪦', '🌳', '🏚️'],
};

const AUTHOR_COLORS = ['#FFD700', '#FF1867', '#00BFFF', '#43AA8B', '#FF8C00', '#FF69B4', '#f06449', '#573280'];

// ── Small pure helpers ──────────────────────────────────────
function initials(name) {
  return (name || '?').trim().charAt(0).toUpperCase();
}
function excerptText(e, t) {
  if (!e) return '';
  if (e.isVoice) return t.cg_voice || '🎙️ voice note';
  if (e.hasMedia) return t.cg_media || '🖼 media';
  return e.content;
}
function timeLabel(iso, lang) {
  if (!iso) return '';
  const d = new Date(iso);
  const day = d.toLocaleDateString(lang || 'en', { month: 'short', day: 'numeric' });
  const tm = d.toLocaleTimeString(lang || 'en', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${day} · ${tm}`;
}
function peakMeta(peak, lang, t) {
  return [
    `${peak.count} ${t.chaos_unit_msgs || 'msgs'}`,
    `${peak.uniqueSenders} ${t.chaos_unit_ppl || 'ppl'}`,
    timeLabel(peak.ts, lang),
  ];
}
function topAuthor(excerpts) {
  const counts = new Map();
  for (const e of excerpts) counts.set(e.author, (counts.get(e.author) || 0) + 1);
  let top = excerpts[0]?.author;
  for (const [a, c] of counts) if (c > (counts.get(top) || 0)) top = a;
  return top;
}
function jitter(rng, pos, range) {
  return { x: Math.round(pos.x + rng.range(-range, range)), y: Math.round(pos.y + rng.range(-range, range)) };
}
function seededLandmarks(rng, bounds, count, kind) {
  const pool = LANDMARK_EMOJI[kind] || LANDMARK_EMOJI.era;
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push({
      x: Math.round(bounds.x + rng.range(24, bounds.w - 24)),
      y: Math.round(bounds.y + rng.range(24, bounds.h - 24)),
      emoji: rng.pick(pool),
    });
  }
  return out;
}
function densityFromEra(era) {
  if (!era) return 6;
  return Math.max(5, Math.min(14, Math.round(5 + (era.msgPerDay || 0) / 8)));
}
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Arranges `n` case positions inside `bounds` with enough spacing
// that triggerRadius (64) circles never overlap — a loose grid,
// jittered per-cell, then shuffled so build order != spatial order.
function placeCases(rng, bounds, n) {
  if (n <= 0) return [];
  if (n === 1) {
    return [jitter(rng, { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 }, Math.min(bounds.w, bounds.h) * 0.2)];
  }
  const cols = Math.max(1, Math.round(Math.sqrt(n * bounds.w / bounds.h)));
  const rows = Math.ceil(n / cols);
  const cellW = bounds.w / cols;
  const cellH = bounds.h / rows;
  const margin = Math.min(cellW, cellH) * 0.15;
  const jitterRange = Math.max(0, Math.min(cellW, cellH) / 2 - margin - 64);
  const positions = [];
  for (let i = 0; i < n; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = bounds.x + col * cellW + cellW / 2;
    const cy = bounds.y + row * cellH + cellH / 2;
    positions.push(jitter(rng, { x: cx, y: cy }, jitterRange));
  }
  return rng.shuffle(positions);
}

// Member medallions for tap-to-pair: required (correct-answer) authors
// plus enough of the chat's other top participants to make the
// placement a real deduction, not a 1:1 giveaway.
function buildMedallions(analytics, requiredAuthors, rng, minCount = 4) {
  const allAuthors = (analytics.users || []).map(u => u.author);
  const set = new Set(requiredAuthors.filter(Boolean));
  for (const a of allAuthors) {
    if (set.size >= Math.min(minCount, allAuthors.length)) break;
    set.add(a);
  }
  const list = rng.shuffle(Array.from(set));
  return list.map((author, i) => ({ id: author, label: initials(author), color: AUTHOR_COLORS[i % AUTHOR_COLORS.length] }));
}

// ── Template 0 — Excavate("when") + Reconstruct(1 bubble, "who") ──
// Variant 0 is the Gates tutorial framing; variants 1-2 are
// district-neutral re-skins for repeats in era districts.
const TEMPLATE0_COPY = [
  { titleKey: 'ruins_case_a_title', titleFallback: 'The First Spark',
    leadKey: 'ruins_case_a_lead', leadFallback: 'A scorch mark glows just past the gate. Something happened here.' },
  { titleKey: 'ruins_t0_v1_title', titleFallback: 'The Buried Hour',
    leadKey: 'ruins_t0_v1_lead', leadFallback: 'Something is half-buried here — a moment, frozen mid-sentence.' },
  { titleKey: 'ruins_t0_v2_title', titleFallback: 'The Forgotten Bench',
    leadKey: 'ruins_t0_v2_lead', leadFallback: 'A quiet corner holds a fragment nobody thought to keep.' },
];

function buildTemplate0(peak, pos, id, districtId, analytics, t, lang, rng, variantIdx) {
  const tod = todKey(peak.hour);
  const whoAuthor = topAuthor(peak.excerpts);
  const copy = TEMPLATE0_COPY[variantIdx] || TEMPLATE0_COPY[0];

  const slots = [
    { id: 'when', label: t.ruins_slot_when || 'When did it happen?', answer: tod, answerLabel: t[`cg_tod_${tod}`] || tod },
    { id: 'who', label: t.ruins_slot_who || 'Who started it?', answer: whoAuthor, answerLabel: whoAuthor },
  ];

  const fragmentSource = peak.excerpts.find(e => !e.isVoice && !e.hasMedia) || peak.excerpts[0];
  const excavate = {
    slotId: 'when',
    fragmentText: excerptText(fragmentSource, t),
    revealText: interp(t.ruins_excavate_reveal_when || 'A fragment, half-burnt: it happened in the {bucket}.', {
      bucket: t[`cg_tod_${tod}`] || tod,
    }),
  };

  const bubbleSource = peak.excerpts.find(e => e.author === whoAuthor) || peak.excerpts[0];
  const reconstruct = {
    bubbles: [{ slotId: 'who', text: excerptText(bubbleSource, t), answer: whoAuthor }],
    medallions: buildMedallions(analytics, [whoAuthor], rng),
  };

  return {
    id, districtId, pos, triggerRadius: 64,
    monumentForm: monumentForm(peak), emoji: MONUMENT_EMOJI[monumentForm(peak)],
    verb: 'tutorial',
    title: t[copy.titleKey] || copy.titleFallback,
    lead: t[copy.leadKey] || copy.leadFallback,
    slots,
    evidence: { excavate, reconstruct },
    reveal: { excerpts: peak.excerpts, meta: peakMeta(peak, lang, t) },
  };
}

// ── Template 1 — Interrogate, 3 slots (who/when/lastWord) ────────
const TEMPLATE1_COPY = [
  { titleKey: 'ruins_case_b_title', titleFallback: 'The Roaring Hall',
    leadKey: 'ruins_case_b_lead', leadFallback: 'An echo lingers here, eager to talk — if you ask the right questions.' },
  { titleKey: 'ruins_t1_v1_title', titleFallback: 'The Whispering Gallery',
    leadKey: 'ruins_t1_v1_lead', leadFallback: 'Voices overlap in this chamber — sort fact from echo.' },
  { titleKey: 'ruins_t1_v2_title', titleFallback: 'The Court of Echoes',
    leadKey: 'ruins_t1_v2_lead', leadFallback: 'An old witness waits, ready to testify — for a price of attention.' },
];

function buildTemplate1(peak, pos, id, districtId, analytics, t, lang, rng, variantIdx) {
  const tod = todKey(peak.hour);
  const whoAuthor = topAuthor(peak.excerpts);
  const lastAuthor = peak.excerpts[peak.excerpts.length - 1]?.author || whoAuthor;
  const npcUser = analytics.userMap?.[whoAuthor] || {};
  const copy = TEMPLATE1_COPY[variantIdx] || TEMPLATE1_COPY[0];

  const slots = [
    { id: 'who', label: t.ruins_slot_who_ignite || 'Who lit the fuse?', answer: whoAuthor, answerLabel: whoAuthor },
    { id: 'when', label: t.ruins_slot_when || 'When did it happen?', answer: tod, answerLabel: t[`cg_tod_${tod}`] || tod },
    { id: 'lastWord', label: t.ruins_slot_last || 'Who had the last word?', answer: lastAuthor, answerLabel: lastAuthor },
  ];

  const testimonies = rng.shuffle([
    {
      slotId: 'who',
      text: interp(t.ruins_testimony_who || '{name} wouldn\'t stop saying "{word}" — that\'s your culprit.', {
        name: whoAuthor, word: npcUser.topWord || '…',
      }),
    },
    {
      slotId: 'when',
      text: interp(t.ruins_testimony_when || 'It was deep in the {bucket}. I remember exactly.', {
        bucket: t[`cg_tod_${tod}`] || tod,
      }),
    },
    {
      slotId: 'lastWord',
      text: interp(t.ruins_testimony_last || '{name} got the last word in. As always.', { name: lastAuthor }),
    },
  ]);

  return {
    id, districtId, pos, triggerRadius: 64,
    monumentForm: monumentForm(peak), emoji: MONUMENT_EMOJI[monumentForm(peak)],
    verb: 'interrogate',
    title: t[copy.titleKey] || copy.titleFallback,
    lead: t[copy.leadKey] || copy.leadFallback,
    slots,
    evidence: { interrogate: { npc: { author: whoAuthor, initial: initials(whoAuthor) }, testimonies } },
    reveal: { excerpts: peak.excerpts, meta: peakMeta(peak, lang, t) },
  };
}

// ── Template 2 — Reconstruct (up to 3 bubbles, one per slot) ─────
const TEMPLATE2_COPY = [
  { titleKey: 'ruins_case_c_title', titleFallback: 'The Shattered Square',
    leadKey: 'ruins_case_c_lead', leadFallback: 'Voices, frozen mid-sentence. Whose words are these?' },
  { titleKey: 'ruins_t2_v1_title', titleFallback: 'The Mosaic Floor',
    leadKey: 'ruins_t2_v1_lead', leadFallback: 'Tiles, each etched with a different voice — piece them back together.' },
  { titleKey: 'ruins_t2_v2_title', titleFallback: 'The Cracked Fountain',
    leadKey: 'ruins_t2_v2_lead', leadFallback: 'Words ripple across the water, unsigned. Who do they belong to?' },
];

function buildTemplate2(peak, pos, id, districtId, analytics, t, lang, rng, variantIdx) {
  const seen = new Set();
  const picks = [];
  for (const e of peak.excerpts) {
    if (picks.length >= 3) break;
    if (seen.has(e.author)) continue;
    seen.add(e.author);
    picks.push(e);
  }
  const copy = TEMPLATE2_COPY[variantIdx] || TEMPLATE2_COPY[0];

  const slots = picks.map((e, i) => ({
    id: `bubble_${i}`, label: t.ruins_slot_author || 'Who said this?', answer: e.author, answerLabel: e.author,
  }));

  const reconstruct = {
    bubbles: picks.map((e, i) => ({ slotId: `bubble_${i}`, text: excerptText(e, t), answer: e.author })),
    medallions: buildMedallions(analytics, picks.map(e => e.author), rng),
  };

  return {
    id, districtId, pos, triggerRadius: 64,
    monumentForm: monumentForm(peak), emoji: MONUMENT_EMOJI[monumentForm(peak)],
    verb: 'reconstruct',
    title: t[copy.titleKey] || copy.titleFallback,
    lead: t[copy.leadKey] || copy.leadFallback,
    slots,
    evidence: { reconstruct },
    reveal: { excerpts: peak.excerpts, meta: peakMeta(peak, lang, t) },
  };
}

// ── Figure cases — Legendary Figure echoes (Reconstruct-only) ────
// Real excerpts by the figure's author make the strongest reveal
// payoff; if the peaks never caught them speaking, fall back to
// their own (stat-seasoned) tell lines.
function excerptsForFigure(analytics, figure) {
  const peaks = analytics?.chaos?.peaks || [];
  const out = [];
  for (const p of peaks) {
    for (const e of p.excerpts) {
      if (e.author === figure.author && !e.isVoice && !e.hasMedia) {
        out.push(e);
        if (out.length >= 2) return out;
      }
    }
  }
  if (out.length) return out;
  return figure.tells.map(text => ({ author: figure.author, content: text }));
}
function figureMeta(figure, t) {
  const items = [figure.title];
  const { n, pct } = figure.tellVars;
  if (n !== undefined) items.push(interp(t.ruins_figure_unit_count || '{n}×', { n }));
  if (pct !== undefined) items.push(interp(t.ruins_figure_unit_pct || '{pct}%', { pct }));
  return items;
}
function buildFigureCase(figure, pos, id, districtId, analytics, t, rng) {
  const slots = figure.tells.map((_, i) => ({
    id: `tell_${i}`, label: t.ruins_slot_figure_who || 'Whose echo is this?', answer: figure.author, answerLabel: figure.author,
  }));

  const reconstruct = {
    bubbles: figure.tells.map((text, i) => ({ slotId: `tell_${i}`, text, answer: figure.author })),
    medallions: buildMedallions(analytics, [figure.author], rng),
  };

  return {
    id, districtId, pos, triggerRadius: 64,
    monumentForm: 'statue', emoji: figure.emoji,
    verb: 'figure',
    title: figure.title,
    lead: figure.lead,
    slots,
    evidence: { reconstruct },
    reveal: { excerpts: excerptsForFigure(analytics, figure), meta: figureMeta(figure, t) },
  };
}

// ── Joke Shrine cases — recurring-phrase micro-cases ──────────────
// Excavate auto-reveals the phrase + how often/long it recurred;
// Reconstruct pins one real occurrence on its top author.
function buildJokeCase(joke, pos, id, districtId, analytics, t, rng) {
  const slots = [
    { id: 'phrase', label: t.ruins_slot_joke_phrase || 'What was the running joke?', answer: joke.phrase, answerLabel: `"${joke.phrase}"` },
    { id: 'author', label: t.ruins_slot_author || 'Who said this?', answer: joke.topAuthor, answerLabel: joke.topAuthor },
  ];

  const excavate = {
    slotId: 'phrase',
    fragmentText: t.ruins_joke_excavate_fragment || 'Something is etched here, over and over, worn smooth by repetition.',
    revealText: interp(t.ruins_joke_excavate_reveal || 'They said it {count} times, across {weeks} weeks: "{phrase}"', {
      count: joke.count, weeks: joke.weeks, phrase: joke.phrase,
    }),
  };

  const bubbleSource = joke.samples[joke.samples.length - 1] || joke.samples[0];
  const reconstruct = {
    bubbles: [{ slotId: 'author', text: bubbleSource?.content || joke.phrase, answer: joke.topAuthor }],
    medallions: buildMedallions(analytics, [joke.topAuthor], rng),
  };

  return {
    id, districtId, pos, triggerRadius: 64,
    monumentForm: 'shrine', emoji: '📜',
    verb: 'joke',
    title: t.ruins_joke_title || 'The Sacred Phrase',
    lead: t.ruins_joke_lead || 'Worn grooves spell out words repeated until they became ritual.',
    slots,
    evidence: { excavate, reconstruct },
    reveal: {
      excerpts: joke.samples,
      meta: [
        interp(t.ruins_joke_meta_count || '{count}× repeated', { count: joke.count }),
        interp(t.ruins_joke_meta_weeks || 'across {weeks} weeks', { weeks: joke.weeks }),
      ],
    },
  };
}

// ── Kingdom ────────────────────────────────────────────────
export function buildKingdom(analytics, t, lang) {
  const chaos = analytics?.chaos;
  const peaks = (chaos?.peaks || []).filter(p => p.excerpts?.length > 0);
  if (!peaks.length) return null;

  const rng = makeRng(chatSeed(analytics));

  const allEras = analytics.eras || [];
  const numEraDistricts = Math.min(allEras.length, 3);
  // Furthest era district (highest index) = oldest analytics era ("the
  // ancient past"); the one closest to Gates = the most recent of the
  // selected eras.
  const selectedEras = allEras.slice(0, numEraDistricts);

  const nightHeavy = (analytics.groupNightPct || 0) > 25;
  const gatesPalette = nightHeavy ? PALETTE_NIGHT : PALETTE_DAY;

  const H = GAP * (numEraDistricts + 1) + numEraDistricts * ERA_H + HEART_H + GATES_H;
  const heartZoneY = numEraDistricts * (GAP + ERA_H);
  const gatesY = heartZoneY + HEART_H;

  const gatesBounds = { x: 40, y: gatesY, w: 640, h: GATES_H };
  const heart = { pos: { x: WORLD.W / 2, y: heartZoneY + HEART_H / 2 }, radius: 44 };
  const spawn = { x: WORLD.W / 2, y: gatesY + GATES_H - 80 };

  const districts = [
    {
      id: 'gates',
      name: t.ruins_district_gates || 'Gates & Outskirts',
      bounds: gatesBounds,
      palette: gatesPalette,
      landmarks: seededLandmarks(rng, gatesBounds, 6, 'gates'),
    },
  ];

  // era district i (0 = closest to gates) <-> selectedEras[n-1-i]
  for (let i = 0; i < numEraDistricts; i++) {
    const era = selectedEras[numEraDistricts - 1 - i];
    const bounds = { x: 40, y: GAP + (numEraDistricts - 1 - i) * (ERA_H + GAP), w: 640, h: ERA_H };
    districts.push({
      id: `era${i}`,
      name: interp(t.ruins_district_era || 'The {name} District', { name: era?.name || (t.ruins_district_era_fallback || 'Old Quarter') }),
      bounds,
      palette: paletteForEra(era),
      landmarks: seededLandmarks(rng, bounds, densityFromEra(era), 'era'),
    });
  }
  const eraDistrictIds = districts.slice(1).map(d => d.id);

  // ── Case generation ──────────────────────────────────────────
  const cases = [];

  // Gates always gets 1 case: the gentlest peak (last in the sorted
  // peaks array), template 0 (the tutorial framing).
  const gatesPeak = peaks[peaks.length - 1];
  const remainingPeaks = peaks.slice(0, -1);

  const figures = buildFigures(analytics, t);
  const mainCases = peaks.length;
  const figureBudget = clamp(10 - mainCases, 0, 3);
  const jokeBudget = clamp(12 - mainCases - figureBudget, 0, Math.min(2, (analytics.runningJokes || []).length));

  const pickedFigures = pickFigureCases(figures, rng, figureBudget);
  const pickedJokes = (analytics.runningJokes || []).slice(0, jokeBudget);

  const [gatesPos] = placeCases(rng, gatesBounds, 1);
  cases.push(buildTemplate0(gatesPeak, gatesPos, `peak_${peaks.length - 1}`, 'gates', analytics, t, lang, rng, 0));

  // Round-robin remaining peaks + figures + jokes across era districts.
  const items = [];
  remainingPeaks.forEach((peak, idx) => {
    items.push({ kind: 'peak', peak, peakIndex: idx, templateIdx: idx % 3, variantIdx: Math.floor(idx / 3) % 3 });
  });
  pickedFigures.forEach(figure => items.push({ kind: 'figure', figure }));
  pickedJokes.forEach((joke, i) => items.push({ kind: 'joke', joke, jokeIdx: i }));

  let globalIndex = 0;
  const byDistrict = new Map();
  for (const item of items) {
    const di = eraDistrictIds[globalIndex % eraDistrictIds.length];
    globalIndex++;
    if (!byDistrict.has(di)) byDistrict.set(di, []);
    byDistrict.get(di).push(item);
  }

  for (const [districtId, districtItems] of byDistrict) {
    const district = districts.find(d => d.id === districtId);
    const positions = placeCases(rng, district.bounds, districtItems.length);
    districtItems.forEach((item, i) => {
      const pos = positions[i];
      if (item.kind === 'peak') {
        const id = `peak_${item.peakIndex}`;
        if (item.templateIdx === 0) cases.push(buildTemplate0(item.peak, pos, id, districtId, analytics, t, lang, rng, item.variantIdx));
        else if (item.templateIdx === 1) cases.push(buildTemplate1(item.peak, pos, id, districtId, analytics, t, lang, rng, item.variantIdx));
        else cases.push(buildTemplate2(item.peak, pos, id, districtId, analytics, t, lang, rng, item.variantIdx));
      } else if (item.kind === 'figure') {
        cases.push(buildFigureCase(item.figure, pos, `figure_${item.figure.archetypeKey}`, districtId, analytics, t, rng));
      } else {
        cases.push(buildJokeCase(item.joke, pos, `joke_${item.jokeIdx}`, districtId, analytics, t, rng));
      }
    });
  }

  // ── Leads: every non-final case points to a random other district;
  // the final case keeps the "more of the kingdom" teaser hook.
  const hook = t.ruins_hook_more || 'The rest of the kingdom waits in the fog — more ruins to come.';
  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    if (i === cases.length - 1) {
      c.leadsAfter = [hook];
    } else {
      const others = districts.filter(d => d.id !== c.districtId);
      const target = rng.pick(others.length ? others : districts);
      c.leadsAfter = [interp(t.ruins_lead_elsewhere || 'Witnesses speak of something stirring in {district}.', { district: target.name })];
    }
  }

  return {
    world: { W: WORLD.W, H },
    spawn,
    districts,
    heart,
    cases,
    openingLead: t.ruins_opening_lead || 'The records are sealed. The factions lie. You\'re new — nobody will suspect you of having a side.',
  };
}
