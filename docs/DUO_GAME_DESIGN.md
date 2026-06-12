# THE LONG RUN — Duo Mode redesign

> Design document for replacing "The Versus" (DuoAnalysis) with a progression-based
> mini game built from the pair's chat data. Written before implementation; the
> shipped code follows this spec.

---

## 1. Why the current experience fails

The Versus is a *quiz show where you already know the answers and can't change them*.

| Failure | Mechanism |
|---|---|
| No agency | The only verb is "tap to reveal". Input never changes any outcome. |
| No uncertainty | All 12 round metrics (messages, reply speed, night %…) were already shown in the main recap. Nothing to wonder about. |
| No skill | You cannot be good or bad at it. Mastery is impossible, so replay is pointless. |
| No progression | One bout. Rematch is literally identical (deterministic data, zero state). Nothing persists. |
| No discovery | Every round has the same shape: two bars, a crown. Nothing hidden, nothing optional, nothing missable. |
| No identity | No avatar, no growth, nothing that is "mine". |
| Weak share moment | "X beat Y 4–3" carries no story and no image. |

Root cause: it presents data *about* the couple instead of building a world *from* the couple. Fix = move every insight behind a gameplay verb (jump, find, bet) so the player earns it.

## 2. Concept generation (12 concepts, critiqued)

1. **Chat Dungeon** — procedural dungeon, rooms = months, monsters = silences, loot = quotes.
   *Critique:* rich theme; but data→combat mapping is arbitrary, top-down movement is clumsy in a 9:16 tap-only frame, very high build cost. ❌
2. **The Climb** — co-op tower ascent; months = floors; silences = gaps; tap-timing to climb.
   *Critique:* beautiful metaphor ("relationship as a climb"), simple verb. Vertical level shapes from data are weak (one parameter: gap size). Partial keep. ◐
3. **Message Rush** — side-scrolling runner along the chat timeline; the year literally becomes terrain; collect the pair's real emojis, dodge ghosts of silences, storms of chaos peaks.
   *Critique:* proven one-thumb mobile genre; the seismogram/eras/silences map *directly* to level geometry (the data IS the level, not decoration); skill, score, and replay come free. Best data-fit and best verb. ✅
4. **Heartline** — rhythm game on texting tempo. *Critique:* needs audio; app is silent by design. ❌
5. **Duo Tamagotchi** — pet grown from chat health, fed monthly. *Critique:* great retention hook, zero gameplay verbs; data is static between exports so the pet is a screensaver. Keep the *monthly season* idea only. ◐
6. **Excavation** — scratch-card archaeology dig; layers = eras; artifacts = real quotes.
   *Critique:* delightful discovery, no skill, 5-minute lifespan. Keep as a *mechanic* (buried memory capsules), not the game. ◐
7. **Ship Voyage** — steer a two-person boat; storms = chaos, doldrums = silences. *Critique:* charming but slow pacing, continuous steering fights the vertical frame. ❌
8. **Versus Royale** — keep the fight, make rounds skill mini-games. *Critique:* still a stat deck at heart; pass-the-phone duels are awkward solo. ❌
9. **Memory Heist** — stealth puzzle through an archive vault. *Critique:* stealth needs precision controls; overscoped. ❌
10. **Garden of Us** — idle gardening on real-time timers. *Critique:* passive; real-time timers fight the app's deterministic spirit. ❌
11. **Chat Kart** — racing on a year-shaped track. *Critique:* the runner does the same fantasy at a third of the cost. ❌
12. **Trial of Two** — narrative chapters ending in prediction duels ("who replied faster at 2am?").
    *Critique:* betting on your own relationship converts stats into *anticipation + surprise* — the single best trick for making data feel like gameplay. Not enough for a whole game; perfect as boss fights. ◐

## 3. Selected concept (fusion)

**THE LONG RUN** — concept #3 as the chassis, absorbing the best organ from each near-miss:

- From #2: co-op fantasy — your partner runs beside you as a companion spirit who powers your assist.
- From #6: **Memory Capsules** — love letters buried on hard-to-reach platforms holding *real recovered moments* (chaos-peak excerpts, record days) the recap never showed.
- From #12: **Gatekeeper bosses** — each level ends with a bet on a hidden pair-fact ("Who owns the midnight hour?"). You answer by *picking a side*, then watch the truth land.
- From #5: **Seasons** — every new monthly export appends a season; the album persists per pair.

The name is the thesis: a relationship is a long run — gaps you jump together, storms you push through, and things worth going back for.

### Design iterations applied
- **v1:** plain runner with stat pickups → felt like a skin. *Cut floating stat cards entirely.*
- **v2:** added capsules + bosses → discovery and anticipation appear, but death = restart was punishing → **fall = lose a heart and respawn ahead**, full fail only at 0 hearts; retry is <1s.
- **v3:** all 8 levels open → no "one more level" pull → **linear unlock + star gates at zones 3 (4★) and 4 (9★)**, so replaying earlier levels for 3★ is motivated, not grindy.
- **v4:** jump felt floaty on mobile → variable jump (hold = higher), coyote time 90ms, jump buffer 120ms, squash-and-stretch on landing.
- **v5:** boss wrong-answer felt like punishment → wrong answer still completes the level ("plot twist!" framing); the star is the carrot, never a wall.

### Stress test
- **Engagement:** every 5–10s contains an input decision (gap timing, bat weave, capsule detour). Capsule platforms are deliberately risky — curiosity vs. safety tension.
- **Retention:** stars missing on the map are visible scabs; double-jump unlocks at 6★ (ability progression, not just cosmetic); album silhouettes show what's still buried.
- **Replayability:** 3★ per level (finish / capsule / boss bet) rarely happens first try; skill ceiling via combo meter.
- **Emotional payoff:** capsules surface *actual messages from their craziest minutes* — the strongest material in the dataset, currently buried in Chaos mode where this pair never sees it framed as "ours".
- **Failure modes considered:** tiny chats (short levels, fallback artifacts, question pool filters by eligibility); 2-person couple chat (pair locked, picker hidden); 50-person group (picker seeds to topDuo).

## 4. Core loop (30–90s per level)

```
MAP (pick level, see stars missing)
 → RUN  (auto-run; tap=jump, hold=higher; collect their emojis; dodge data-born hazards)
   → mid-run: MEMORY CAPSULE on a risky platform → pause → artifact card reveal → album
 → GATEKEEPER (bet on a hidden pair-fact; pick a side; truth animates in)
 → RESULTS (stars burst, combo, insight, share card)
 → "NEXT: <name of next level>" — one tap back into the loop
```

## 5. Level generation (the data IS the level)

8 levels = 8 equal slices of the chat timeline. Per slice, from `analytics`:

| Data | Level effect |
|---|---|
| `chaos.seismogram` slice mean/max | obstacle density, scroll speed ramp, storm zone (raining ✉️ + screen shake) |
| zero-activity runs in slice | pit widths ("the silence of…") |
| era `nightPct` | midnight palette, bats 🦇 with sine flight |
| slice containing `longestAbsenceDays` | the GHOST level — a 👻 stalks behind you |
| pair's `top5Emojis` | the coins themselves |
| `loveYouCount` | heart pickups |
| era boundaries | zone palettes (dawn → gold → dusk → midnight) |

All placement via seeded PRNG (`mulberry32(rHash(start|end|A|B|level))`). **Zero `Math.random()`** — same chat, same world, every time. Difficulty ramps across levels and within a level.

## 6. Progression, rewards, collectibles

- **Stars (0–3/level):** finish ★ · find capsule ★ · win the boss bet ★. Gate zones; 24★ max per season.
- **Album:** capsule artifacts (recovered transcripts, record days, the great silence…) as collectible cards; unfound = silhouettes with hints. Persists per pair.
- **Abilities:** 6★ → double jump (opens previously unreachable capsule routes — old levels become new).
- **Trails:** cosmetic player trails at 3/9/15★; equipped from the map.
- **Combo:** coins without damage build a multiplier; best combo on results screen (mastery metric).
- **Partner assist:** coin meter fills → companion fires a 4s magnet burst (co-op flavor: they help you).
- **Seasons (monthly):** save key = pair + chat-start; each export's end-month = a season. Map shows current season; shelf shows past season badges. Album accumulates forever → long-term progression.

## 7. Onboarding (first win < 60s)

No tutorial modal. Level 1 opens with a long safe runway and a painted "HOLD TO JUMP HIGHER" signpost; first gap is generous; first capsule is on a *low* platform ~20s in (guaranteed first win); first boss question is the pool's most charged one. Pair picker only appears for >2-person chats, pre-seeded to `topDuo`.

## 8. Animation & juice inventory

Runner: squash/stretch landing, jump dust, coin pop + float-up score, hit flash + 1.2s invincibility blink, storm screen-shake, parallax (sky/hills/ground), trail particles, companion bobbing. UI: map nodes pop in staggered, stars burst on results (scaleSpring), capsule opens with envelope-unfold + card flip, boss truth bars race, gate slam on wrong answer. All CSS keyframes + canvas; `prefers-reduced-motion` disables shake/particles/infinite loops.

## 9. Sharing

Results screen renders a **Run Card** on an offscreen canvas (no DOM capture — sidesteps the known share-card export bug): both avatars, level name, stars, best combo, and the unlocked insight line ("We survived The Great Silence — 23 days"). `navigator.share` with PNG file → fallback download → fallback existing ShareSheet text flow.

## 10. Technical architecture

```
src/duo/
  rng.js        seeded PRNG + hash (determinism)
  storage.js    per-pair save: stars, album, trails, seasons (localStorage cw_duoquest_v1)
  levelGen.js   analytics → 8 level layouts (platforms, hazards, coins, capsule, palette)
  questions.js  analytics → eligible boss-bet pool (pair-asymmetric, non-recap facts)
  artifacts.js  analytics → capsule artifact pool (chaos excerpts, records, silences)
  RunCanvas.jsx canvas engine: fixed-step physics, input, render, juice; emits events up
src/views/DuoQuest.jsx  stage shell: map / run / overlays / results / album
```

- Engine: `requestAnimationFrame`, fixed 360×560 logical resolution scaled by DPR; pauses on `visibilitychange`; React only for chrome/overlays — the hot path never re-renders React.
- Invariants kept: no network, no `Math.random()` in anything user-visible, no new deps, all copy through i18n (`duoq_*` keys, en first, he mirrored).
- `App.jsx` keeps the `duo` stage; only the imported view changes.
