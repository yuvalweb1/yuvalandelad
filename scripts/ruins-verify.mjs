// Headless data-shape verification for The Ruins of [GroupName], Phase 2.
// Parses public/demo_chat.txt, runs computeAll + buildKingdom/buildFigures,
// and sanity-checks running jokes, legendary figures, and district geometry
// for 1/2/3 era districts. No browser automation — pure data checks.
// Run: node scripts/ruins-verify.mjs
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseWhatsApp } from '../src/parser/parse.js';
import { computeAll } from '../src/lib/analytics.js';
import { buildT } from '../src/i18n/index.js';
import { buildKingdom } from '../src/ruins/worldGen.js';
import { buildFigures, pickFigureCases } from '../src/ruins/figures.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const raw = readFileSync(resolve(ROOT, 'public/demo_chat.txt'), 'utf8');
const { messages } = parseWhatsApp(raw);
const analytics = computeAll(messages);
const t = buildT('en');

console.log('messages:', messages.length);
console.log('users:', analytics.users.map(u => u.author));
console.log('eras:', analytics.eras.map(e => ({ name: e.name, msgPerDay: e.msgPerDay, nightPct: e.nightPct, mediaPct: e.mediaPct })));
console.log('groupNightPct:', Math.round(analytics.groupNightPct));
console.log('chaos peaks:', analytics.chaos.peaks.length);

console.log('\n--- running jokes ---');
console.log(analytics.runningJokes);

console.log('\n--- figures (all archetypes that clear threshold) ---');
const figures = buildFigures(analytics, t);
for (const f of figures) {
  console.log(`  ${f.archetypeKey.padEnd(13)} author=${f.author.padEnd(10)} value=${String(f.statValue).padEnd(6)} margin=${f.marginScore.toFixed(2)}`);
}

console.log('\n--- kingdom (real data) ---');
const kingdom = buildKingdom(analytics, t, 'en');
console.log('world:', kingdom.world);
console.log('heart:', kingdom.heart);
console.log('spawn:', kingdom.spawn);
for (const d of kingdom.districts) console.log(`  district ${d.id.padEnd(6)} bounds=${JSON.stringify(d.bounds)} name="${d.name}"`);
console.log('cases:', kingdom.cases.length, kingdom.cases.map(c => c.id));
console.log('case verbs:', kingdom.cases.map(c => `${c.id}:${c.verb}`).join(', '));

// ── Geometry sanity for 1/2/3 era districts (synthetic era counts) ──
console.log('\n--- geometry for numEraDistricts = 1, 2, 3 ---');
for (const n of [1, 2, 3]) {
  const synthEras = Array.from({ length: n }, (_, i) => analytics.eras[i % analytics.eras.length]);
  const synth = { ...analytics, eras: synthEras };
  const k = buildKingdom(synth, t, 'en');
  console.log(`n=${n}: world=${JSON.stringify(k.world)} gates.y=${k.districts.find(d=>d.id==='gates').bounds.y} heart.pos=${JSON.stringify(k.heart.pos)} spawn=${JSON.stringify(k.spawn)} districts=${k.districts.map(d=>d.id).join(',')} cases=${k.cases.length}`);
  // Overlap check: gates must not overlap any era district vertically.
  const gates = k.districts.find(d => d.id === 'gates').bounds;
  for (const d of k.districts.filter(x => x.id !== 'gates')) {
    const overlap = gates.y < d.bounds.y + d.bounds.h && d.bounds.y < gates.y + gates.h;
    if (overlap) console.log(`  !! OVERLAP between gates and ${d.id}`);
  }
}

// ── Floor case: 1 era, 1 peak ──
console.log('\n--- floor case: 1 era, 1 peak ---');
const floorAnalytics = { ...analytics, eras: [analytics.eras[0]], chaos: { ...analytics.chaos, peaks: [analytics.chaos.peaks[0]] } };
const floorFigures = buildFigures(floorAnalytics, t);
console.log('floor figures:', floorFigures.map(f => f.archetypeKey));
const floorKingdom = buildKingdom(floorAnalytics, t, 'en');
console.log('floor kingdom: world=', floorKingdom.world, 'districts=', floorKingdom.districts.map(d=>d.id), 'cases=', floorKingdom.cases.length, floorKingdom.cases.map(c=>`${c.id}:${c.verb}`));
