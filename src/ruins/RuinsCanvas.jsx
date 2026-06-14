// ============================================================
// RuinsCanvas — the exploration view for The Ruins of [GroupName].
//
// Redesigned (v3) around a "lantern-lit archaeology" visual language:
// a deep, cool indigo night that the player melts back with a warm
// golden lantern. Exploring no longer punches ugly black holes — it
// REVEALS the district biomes underneath as warm-lit ground, so the
// fog-of-war is a reward, not a void. The Heart is a real beacon
// (glow + light pillar + rising embers), unsolved ruins read as cool
// "mystery" tokens and solved ones as warm gold seals, an edge
// compass keeps the player oriented, and a first-run hint teaches the
// drag-to-move control. One canvas, one rAF loop — React only
// re-renders for the (rare) investigate prompt and the onboarding
// hint. Movement + handoff logic is unchanged from v1.
// ============================================================
import { useRef, useEffect, useState } from 'react';
import { interp } from '../i18n/index.js';

const VIEW_W = 360;
const CELL = 32;
const LANTERN_R = 116;        // generous, atmospheric light radius
const PLAYER_R = 11;
const SPEED = 175;            // world px/sec
const JOY_RADIUS = 48;

// ── Palette — cool night vs. warm lantern ──────────────────────
const NIGHT_TOP   = '#171327';
const NIGHT_BOT   = '#0A0813';
const FOG_RGBA    = 'rgba(9,7,17,0.94)';   // cool indigo, NOT mud-brown
const GOLD        = '#F4C77B';
const GOLD_BRIGHT = '#FFE7B0';
const EMBER       = '#E8965A';
const HEART_GOLD  = '#FFCB5E';
const ICE_RIM     = '#86C0D0';             // unsolved-marker cool rim
const PLAYER_CORE = '#FFF6E2';

const cellKey = (gx, gy) => `${gx},${gy}`;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Soft-edged white circle sprite, cached once per mount. Drawn with
// destination-out it carves feathered holes in the fog — overlapping
// draws give smooth explored regions instead of hard blobby circles.
function makeSoftCircle(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const r = size / 2;
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.55, 'rgba(255,255,255,1)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.beginPath(); g.arc(r, r, r, 0, Math.PI * 2); g.fill();
  return c;
}

// Deterministic faint starfield for the unexplored night (decorative
// only — positions from a tiny LCG, no Math.random).
function makeStars(n, w, h) {
  let s = 0x9e3779b9 >>> 0;
  const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  const out = [];
  for (let i = 0; i < n; i++) out.push({ x: rnd() * w, y: rnd() * h, r: 0.5 + rnd() * 1.1, tw: rnd() * Math.PI * 2 });
  return out;
}

export default function RuinsCanvas({
  kingdom, initialPlayerPos, initialInk = [], litCaseIds = [],
  heartGlowPct = 0, t, lang, isRTL = false, reducedMotion = false,
  onEnterCase,
}) {
  const canvasRef = useRef(null);
  const [prompt, setPrompt] = useState(null);            // { caseId, label, emoji } | null
  const [showHint, setShowHint] = useState(initialInk.length < 24); // fresh season → teach controls
  const stateRef = useRef(null);                         // { pos, ink } — live snapshot for handoff
  const movedRef = useRef(false);

  const sealed = litCaseIds.length;
  const total = kingdom?.cases?.length || 0;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !kingdom) return;
    const ctx = canvas.getContext('2d');
    if (!ctx.roundRect) {
      ctx.roundRect = function (x, y, w, h, r) {
        const rr = Math.min(r || 0, w / 2, h / 2);
        this.moveTo(x + rr, y);
        this.arcTo(x + w, y, x + w, y + h, rr);
        this.arcTo(x + w, y + h, x, y + h, rr);
        this.arcTo(x, y + h, x, y, rr);
        this.arcTo(x, y, x + w, y, rr);
        this.closePath();
      };
    }

    const WORLD = kingdom.world;
    const gridW = Math.ceil(WORLD.W / CELL);
    const gridH = Math.ceil(WORLD.H / CELL);
    const softInk = makeSoftCircle(72);
    const softLantern = makeSoftCircle(256);
    const litSet = new Set(litCaseIds);

    // ── View ───────────────────────────────────────────────
    const view = { scale: 1, h: 560, cssW: VIEW_W };
    function resize() {
      const parent = canvas.parentElement;
      if (!parent) return;
      const cssW = parent.clientWidth, cssH = parent.clientHeight;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      canvas.style.width = cssW + 'px';
      canvas.style.height = cssH + 'px';
      view.scale = (cssW / VIEW_W) * dpr;
      view.h = canvas.height / view.scale;
      view.cssW = cssW;
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement);

    const stars = makeStars(70, VIEW_W, 640);

    // ── World state ────────────────────────────────────────
    const start = initialPlayerPos || kingdom.spawn;
    const p = { x: start.x, y: start.y };
    const ink = new Set(initialInk);
    const cam = { x: clamp(p.x - VIEW_W / 2, 0, WORLD.W - VIEW_W), y: clamp(p.y - view.h / 2, 0, Math.max(0, WORLD.H - view.h)) };
    let nearCase = null;

    stateRef.current = { pos: p, ink };

    function markInk() {
      const gxMin = Math.max(0, Math.floor((p.x - LANTERN_R) / CELL));
      const gxMax = Math.min(gridW - 1, Math.floor((p.x + LANTERN_R) / CELL));
      const gyMin = Math.max(0, Math.floor((p.y - LANTERN_R) / CELL));
      const gyMax = Math.min(gridH - 1, Math.floor((p.y + LANTERN_R) / CELL));
      for (let gy = gyMin; gy <= gyMax; gy++) {
        for (let gx = gxMin; gx <= gxMax; gx++) {
          const cx = gx * CELL + CELL / 2, cy = gy * CELL + CELL / 2;
          if ((cx - p.x) ** 2 + (cy - p.y) ** 2 <= LANTERN_R * LANTERN_R) ink.add(cellKey(gx, gy));
        }
      }
    }
    markInk();

    // ── Input ──────────────────────────────────────────────
    const keys = {};
    const joy = { active: false, pointerId: null, ox: 0, oy: 0, cx: 0, cy: 0 };

    function toWorldHud(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      const f = VIEW_W / rect.width;
      return { x: (clientX - rect.left) * f, y: (clientY - rect.top) * f };
    }
    function onPointerDown(e) {
      const pt = toWorldHud(e.clientX, e.clientY);
      if (pt.x > VIEW_W * 0.5) return; // right side reserved for DOM buttons
      e.preventDefault();
      joy.active = true; joy.pointerId = e.pointerId;
      joy.ox = pt.x; joy.oy = pt.y; joy.cx = pt.x; joy.cy = pt.y;
      canvas.setPointerCapture?.(e.pointerId);
    }
    function onPointerMove(e) {
      if (!joy.active || e.pointerId !== joy.pointerId) return;
      const pt = toWorldHud(e.clientX, e.clientY);
      const dx = pt.x - joy.ox, dy = pt.y - joy.oy;
      const d = Math.hypot(dx, dy);
      if (d > JOY_RADIUS) {
        joy.cx = joy.ox + (dx / d) * JOY_RADIUS;
        joy.cy = joy.oy + (dy / d) * JOY_RADIUS;
      } else { joy.cx = pt.x; joy.cy = pt.y; }
    }
    function onPointerUp(e) {
      if (e.pointerId !== joy.pointerId) return;
      joy.active = false; joy.pointerId = null;
    }
    function onKey(e) {
      const map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right' };
      const k = map[e.key];
      if (!k) return;
      keys[k] = e.type === 'keydown';
    }
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);

    function moveVector() {
      if (joy.active) {
        const dx = joy.cx - joy.ox, dy = joy.cy - joy.oy;
        const d = Math.hypot(dx, dy);
        if (d < 6) return { x: 0, y: 0 };
        const f = Math.min(d, JOY_RADIUS) / JOY_RADIUS;
        return { x: (dx / d) * f, y: (dy / d) * f };
      }
      let x = 0, y = 0;
      if (keys.left) x -= 1;
      if (keys.right) x += 1;
      if (keys.up) y -= 1;
      if (keys.down) y += 1;
      if (x || y) { const d = Math.hypot(x, y); x /= d; y /= d; }
      return { x, y };
    }

    let facing = { x: 0, y: 1 };

    // ── Step ───────────────────────────────────────────────
    function step(dt) {
      const v = moveVector();
      if (v.x || v.y) {
        p.x = clamp(p.x + v.x * SPEED * dt, PLAYER_R, WORLD.W - PLAYER_R);
        p.y = clamp(p.y + v.y * SPEED * dt, PLAYER_R, WORLD.H - PLAYER_R);
        facing = v;
        markInk();
        if (!movedRef.current) { movedRef.current = true; setShowHint(false); }
      }

      const maxCamX = Math.max(0, WORLD.W - VIEW_W);
      const maxCamY = Math.max(0, WORLD.H - view.h);
      const targetX = clamp(p.x - VIEW_W / 2, 0, maxCamX);
      const targetY = clamp(p.y - view.h / 2, 0, maxCamY);
      if (reducedMotion) { cam.x = targetX; cam.y = targetY; }
      else { cam.x += (targetX - cam.x) * 0.12; cam.y += (targetY - cam.y) * 0.12; }

      let best = null, bestD = Infinity;
      for (const c of kingdom.cases) {
        const d = Math.hypot(c.pos.x - p.x, c.pos.y - p.y);
        if (d <= c.triggerRadius && d < bestD) { best = c; bestD = d; }
      }
      if (best?.id !== nearCase?.id) {
        nearCase = best;
        if (!best) setPrompt(null);
        else {
          const lit = litSet.has(best.id);
          setPrompt({ caseId: best.id, emoji: best.emoji, label: lit ? (t.ruins_revisit || 'Revisit case') : (t.ruins_investigate || 'Investigate') });
        }
      }
    }

    // ── Render ─────────────────────────────────────────────
    function worldToScreen(wx, wy) { return { x: wx - cam.x, y: wy - cam.y }; }

    function drawDistricts() {
      for (const d of kingdom.districts) {
        const sx = d.bounds.x - cam.x, sy = d.bounds.y - cam.y;
        if (sx + d.bounds.w < 0 || sx > VIEW_W || sy + d.bounds.h < 0 || sy > view.h) continue;
        // Ground with a soft vertical gradient for depth.
        const g = ctx.createLinearGradient(0, sy, 0, sy + d.bounds.h);
        g.addColorStop(0, d.palette.ground);
        g.addColorStop(1, shade(d.palette.ground, -0.28));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.roundRect(sx, sy, d.bounds.w, d.bounds.h, 26); ctx.fill();
        ctx.strokeStyle = d.palette.accent; ctx.lineWidth = 2; ctx.globalAlpha = 0.45;
        ctx.beginPath(); ctx.roundRect(sx + 1, sy + 1, d.bounds.w - 2, d.bounds.h - 2, 25); ctx.stroke();
        ctx.globalAlpha = 1;

        ctx.font = '23px serif'; ctx.textAlign = 'center';
        ctx.globalAlpha = 0.92;
        for (const lm of d.landmarks) {
          const lx = lm.x - cam.x, ly = lm.y - cam.y;
          if (lx < -20 || lx > VIEW_W + 20 || ly < -20 || ly > view.h + 20) continue;
          ctx.fillText(lm.emoji, lx, ly);
        }
        ctx.globalAlpha = 1; ctx.textAlign = 'start';

        // District label — a small engraved tag.
        if (sy > -30 && sy < view.h) {
          ctx.font = '700 11px "DM Sans", sans-serif';
          const tx = isRTL ? sx + d.bounds.w - 12 : sx + 12;
          ctx.textAlign = isRTL ? 'end' : 'start';
          const ty = clamp(sy + 20, 16, view.h - 6);
          ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillText(d.name, clamp(tx, 6, VIEW_W - 6) + 0.5, ty + 0.5);
          ctx.fillStyle = 'rgba(255,248,232,0.82)'; ctx.fillText(d.name, clamp(tx, 6, VIEW_W - 6), ty);
          ctx.textAlign = 'start';
        }
      }
    }

    function drawFog() {
      const ps = worldToScreen(p.x, p.y);
      ctx.save();
      // Cool night fog over everything.
      ctx.fillStyle = FOG_RGBA;
      ctx.fillRect(0, 0, VIEW_W, view.h);

      // Carve feathered holes for everything explored + the lantern.
      ctx.globalCompositeOperation = 'destination-out';
      const gx0 = Math.max(0, Math.floor(cam.x / CELL) - 1);
      const gx1 = Math.min(gridW - 1, Math.ceil((cam.x + VIEW_W) / CELL) + 1);
      const gy0 = Math.max(0, Math.floor(cam.y / CELL) - 1);
      const gy1 = Math.min(gridH - 1, Math.ceil((cam.y + view.h) / CELL) + 1);
      const half = 52;
      for (let gy = gy0; gy <= gy1; gy++) {
        for (let gx = gx0; gx <= gx1; gx++) {
          if (!ink.has(cellKey(gx, gy))) continue;
          const sx = gx * CELL + CELL / 2 - cam.x, sy = gy * CELL + CELL / 2 - cam.y;
          ctx.globalAlpha = 0.85;
          ctx.drawImage(softInk, sx - half / 2, sy - half / 2, half, half);
        }
      }
      // Bright lantern reveal — flickers gently.
      const flick = reducedMotion ? 1 : 1 + 0.05 * Math.sin(performance.now() / 140);
      const lr = LANTERN_R * 2.2 * flick;
      ctx.globalAlpha = 1;
      ctx.drawImage(softLantern, ps.x - lr / 2, ps.y - lr / 2, lr, lr);
      ctx.restore();

      // Warm torchlight tint hugging the player — makes lantern-lit
      // ground read warm and inviting even over a dark night biome.
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const warm = ctx.createRadialGradient(ps.x, ps.y, 0, ps.x, ps.y, LANTERN_R * 1.2 * flick);
      warm.addColorStop(0, 'rgba(255,206,128,0.30)');
      warm.addColorStop(0.45, 'rgba(240,150,76,0.13)');
      warm.addColorStop(1, 'rgba(232,140,70,0)');
      ctx.fillStyle = warm;
      ctx.beginPath(); ctx.arc(ps.x, ps.y, LANTERN_R * 1.2 * flick, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    function drawVignette() {
      const g = ctx.createRadialGradient(VIEW_W / 2, view.h / 2, view.h * 0.32, VIEW_W / 2, view.h / 2, view.h * 0.72);
      g.addColorStop(0, 'rgba(4,3,9,0)');
      g.addColorStop(1, 'rgba(4,3,9,0.62)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, VIEW_W, view.h);
    }

    function drawHeart(time) {
      const hs = worldToScreen(kingdom.heart.pos.x, kingdom.heart.pos.y);
      if (hs.x < -120 || hs.x > VIEW_W + 120 || hs.y < -view.h || hs.y > view.h + 200) return;
      const intensity = 0.32 + 0.68 * (heartGlowPct / 100);
      const pulse = reducedMotion ? 1 : 1 + 0.05 * Math.sin(time / 620);
      const R = kingdom.heart.radius;

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      // Light pillar rising from the Heart — reads as a beacon from afar.
      const pillarW = R * 1.5;
      const pg = ctx.createLinearGradient(0, hs.y - view.h, 0, hs.y);
      pg.addColorStop(0, 'rgba(255,203,94,0)');
      pg.addColorStop(1, `rgba(255,203,94,${0.10 * intensity})`);
      ctx.fillStyle = pg;
      ctx.fillRect(hs.x - pillarW / 2, hs.y - view.h, pillarW, view.h);

      // Outer + mid glow.
      const og = ctx.createRadialGradient(hs.x, hs.y, 0, hs.x, hs.y, R * 3.4 * pulse);
      og.addColorStop(0, `rgba(255,210,110,${0.55 * intensity})`);
      og.addColorStop(0.4, `rgba(244,160,80,${0.22 * intensity})`);
      og.addColorStop(1, 'rgba(244,160,80,0)');
      ctx.fillStyle = og;
      ctx.beginPath(); ctx.arc(hs.x, hs.y, R * 3.4 * pulse, 0, Math.PI * 2); ctx.fill();

      // Rising embers.
      if (!reducedMotion) {
        for (let i = 0; i < 6; i++) {
          const seed = i * 1.7;
          const cyc = ((time / 2600) + seed) % 1;
          const ex = hs.x + Math.sin(seed * 3 + cyc * 6) * R * 0.6;
          const ey = hs.y - cyc * R * 2.6;
          const a = (1 - cyc) * 0.5 * intensity;
          ctx.fillStyle = `rgba(255,224,150,${a})`;
          ctx.beginPath(); ctx.arc(ex, ey, 1.6 + (1 - cyc) * 1.4, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.restore();

      // Altar rings.
      ctx.strokeStyle = `rgba(255,203,94,${0.5 * intensity})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(hs.x, hs.y, R * 1.25 * pulse, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 0.5;
      ctx.beginPath(); ctx.arc(hs.x, hs.y, R * 1.55 * pulse, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;

      // Core.
      const cg = ctx.createRadialGradient(hs.x, hs.y, 0, hs.x, hs.y, R * pulse);
      cg.addColorStop(0, 'rgba(255,248,224,0.95)');
      cg.addColorStop(0.5, `rgba(255,203,94,${0.6 + 0.3 * intensity})`);
      cg.addColorStop(1, 'rgba(255,203,94,0)');
      ctx.fillStyle = cg;
      ctx.beginPath(); ctx.arc(hs.x, hs.y, R * pulse, 0, Math.PI * 2); ctx.fill();

      ctx.font = `${Math.round(R * 0.95)}px serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('💛', hs.x, hs.y + 1);
      ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
    }

    function drawMarkers(time) {
      for (let i = 0; i < kingdom.cases.length; i++) {
        const c = kingdom.cases[i];
        const cs = worldToScreen(c.pos.x, c.pos.y);
        if (cs.x < -40 || cs.x > VIEW_W + 40 || cs.y < -40 || cs.y > view.h + 40) continue;
        const lit = litSet.has(c.id);
        const phase = i * 1.3;
        const bob = reducedMotion ? 0 : Math.sin(time / 700 + phase) * 3;
        const y = cs.y + bob;
        const pulse = reducedMotion ? 1 : 1 + 0.12 * Math.sin(time / 480 + phase);
        const R = 19;

        // Discovery glow so points of interest read through the dark.
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const glowC = lit ? '255,203,94' : '134,192,208';
        const gg = ctx.createRadialGradient(cs.x, y, 0, cs.x, y, R * 2.4);
        gg.addColorStop(0, `rgba(${glowC},${lit ? 0.4 : 0.26})`);
        gg.addColorStop(1, `rgba(${glowC},0)`);
        ctx.fillStyle = gg;
        ctx.beginPath(); ctx.arc(cs.x, y, R * 2.4, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

        // Invitation ring.
        ctx.strokeStyle = lit ? `rgba(255,203,94,0.85)` : `rgba(134,192,208,0.7)`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cs.x, y, R * pulse + 5, 0, Math.PI * 2); ctx.stroke();

        // Token body.
        const bg = ctx.createRadialGradient(cs.x, y - 4, 2, cs.x, y, R);
        if (lit) { bg.addColorStop(0, '#FFE7B0'); bg.addColorStop(1, '#C8853B'); }
        else     { bg.addColorStop(0, '#241F36'); bg.addColorStop(1, '#15111F'); }
        ctx.fillStyle = bg;
        ctx.beginPath(); ctx.arc(cs.x, y, R, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = lit ? 'rgba(120,78,28,0.9)' : 'rgba(134,192,208,0.55)';
        ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cs.x, y, R, 0, Math.PI * 2); ctx.stroke();

        // Emblem.
        ctx.font = '20px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.globalAlpha = lit ? 1 : 0.92;
        ctx.fillText(c.emoji, cs.x, y + 1);
        ctx.globalAlpha = 1;

        // Solved seal badge.
        if (lit) {
          ctx.fillStyle = '#1B7B4B';
          ctx.beginPath(); ctx.arc(cs.x + R * 0.72, y - R * 0.72, 7, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(cs.x + R * 0.72 - 3, y - R * 0.72);
          ctx.lineTo(cs.x + R * 0.72 - 0.6, y - R * 0.72 + 2.6);
          ctx.lineTo(cs.x + R * 0.72 + 3.2, y - R * 0.72 - 2.6);
          ctx.stroke();
        }
        ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
      }
    }

    function drawPlayer(time) {
      const ps = worldToScreen(p.x, p.y);
      const bob = reducedMotion ? 0 : Math.sin(time / 520) * 1.6;
      const y = ps.y + bob;

      // Contact shadow.
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.ellipse(ps.x, ps.y + PLAYER_R + 4, PLAYER_R * 0.9, PLAYER_R * 0.4, 0, 0, Math.PI * 2); ctx.fill();

      // Lantern halo.
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const halo = ctx.createRadialGradient(ps.x, y, 0, ps.x, y, PLAYER_R * 3.4);
      halo.addColorStop(0, 'rgba(255,224,150,0.5)');
      halo.addColorStop(1, 'rgba(255,224,150,0)');
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(ps.x, y, PLAYER_R * 3.4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      // Orb.
      const og = ctx.createRadialGradient(ps.x - 2, y - 3, 1, ps.x, y, PLAYER_R);
      og.addColorStop(0, '#FFFDF6');
      og.addColorStop(0.6, PLAYER_CORE);
      og.addColorStop(1, '#F4B45A');
      ctx.fillStyle = og;
      ctx.beginPath(); ctx.arc(ps.x, y, PLAYER_R, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(ps.x, y, PLAYER_R, 0, Math.PI * 2); ctx.stroke();
    }

    function drawCompass() {
      // Point to the nearest unsolved ruin, else the Heart.
      let target = null, bestD = Infinity;
      for (const c of kingdom.cases) {
        if (litSet.has(c.id)) continue;
        const d = Math.hypot(c.pos.x - p.x, c.pos.y - p.y);
        if (d < bestD) { bestD = d; target = { x: c.pos.x, y: c.pos.y, emoji: c.emoji }; }
      }
      if (!target) target = { x: kingdom.heart.pos.x, y: kingdom.heart.pos.y, emoji: '💛' };

      const ts = worldToScreen(target.x, target.y);
      const margin = 46;
      const onScreen = ts.x > margin && ts.x < VIEW_W - margin && ts.y > margin + 40 && ts.y < view.h - margin;
      if (onScreen) return; // no need — it's visible

      const cx = VIEW_W / 2, cy = view.h / 2;
      let dx = ts.x - cx, dy = ts.y - cy;
      const dist = Math.hypot(dx, dy) || 1;
      dx /= dist; dy /= dist;
      const rx = VIEW_W / 2 - 30, ry = view.h / 2 - 84;
      const sc = Math.min(rx / Math.abs(dx || 1e-3), ry / Math.abs(dy || 1e-3));
      const bx = cx + dx * sc, by = cy + dy * sc;

      ctx.save();
      // Glow.
      ctx.globalCompositeOperation = 'lighter';
      const gg = ctx.createRadialGradient(bx, by, 0, bx, by, 28);
      gg.addColorStop(0, 'rgba(244,199,123,0.5)');
      gg.addColorStop(1, 'rgba(244,199,123,0)');
      ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(bx, by, 28, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';

      // Badge.
      ctx.fillStyle = 'rgba(20,16,30,0.92)';
      ctx.beginPath(); ctx.arc(bx, by, 17, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = GOLD; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.font = '16px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(target.emoji, bx, by + 1);

      // Chevron pointing outward.
      const ang = Math.atan2(dy, dx);
      const ax = bx + Math.cos(ang) * 24, ay = by + Math.sin(ang) * 24;
      ctx.save();
      ctx.translate(ax, ay); ctx.rotate(ang);
      ctx.fillStyle = GOLD;
      ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-4, -5); ctx.lineTo(-4, 5); ctx.closePath(); ctx.fill();
      ctx.restore();

      ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
      ctx.restore();
    }

    function drawStars(time) {
      // Faint twinkle over the deep night base (parallax-free, cheap).
      for (const s of stars) {
        const a = 0.18 + 0.18 * (0.5 + 0.5 * Math.sin(time / 900 + s.tw));
        ctx.fillStyle = `rgba(200,210,255,${a})`;
        const sy = (((s.y - cam.y * 0.15) % view.h) + view.h) % view.h;
        ctx.beginPath(); ctx.arc(s.x, sy, s.r, 0, Math.PI * 2); ctx.fill();
      }
    }

    function drawJoystick() {
      if (!joy.active) return;
      ctx.save();
      // Base ring.
      const bg = ctx.createRadialGradient(joy.ox, joy.oy, 0, joy.ox, joy.oy, JOY_RADIUS);
      bg.addColorStop(0, 'rgba(255,255,255,0.05)');
      bg.addColorStop(1, 'rgba(255,255,255,0.12)');
      ctx.fillStyle = bg;
      ctx.beginPath(); ctx.arc(joy.ox, joy.oy, JOY_RADIUS, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(joy.ox, joy.oy, JOY_RADIUS, 0, Math.PI * 2); ctx.stroke();
      // Knob.
      const kg = ctx.createRadialGradient(joy.cx - 3, joy.cy - 3, 1, joy.cx, joy.cy, 20);
      kg.addColorStop(0, '#FFF6E2'); kg.addColorStop(1, '#F4B45A');
      ctx.fillStyle = kg;
      ctx.beginPath(); ctx.arc(joy.cx, joy.cy, 19, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    function render(time) {
      ctx.setTransform(view.scale, 0, 0, view.scale, 0, 0);
      ctx.clearRect(0, 0, VIEW_W, view.h);

      // Deep night base.
      const base = ctx.createLinearGradient(0, 0, 0, view.h);
      base.addColorStop(0, NIGHT_TOP);
      base.addColorStop(1, NIGHT_BOT);
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, VIEW_W, view.h);
      drawStars(time);

      drawDistricts();
      drawFog();
      drawVignette();

      drawHeart(time);
      drawMarkers(time);
      drawPlayer(time);
      drawCompass();
      drawJoystick();
    }

    // ── Loop ───────────────────────────────────────────────
    let raf = 0, last = 0, acc = 0;
    const STEP = 1 / 60;
    function frame(now) {
      raf = requestAnimationFrame(frame);
      if (!last) last = now;
      let dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      acc += dt;
      let n = 0;
      while (acc >= STEP && n < 6) { step(STEP); acc -= STEP; n++; }
      render(now);
    }
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kingdom]);

  function handleEnter() {
    if (!prompt || !stateRef.current) return;
    const { pos, ink } = stateRef.current;
    onEnterCase?.({ caseId: prompt.caseId, playerPos: { x: pos.x, y: pos.y }, ink: Array.from(ink) });
  }

  const pct = clamp(heartGlowPct, 0, 100);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%', touchAction: 'none' }} />

      {/* ── Premium HUD: Heart restoration meter ─────────────── */}
      <div
        className="fs-sans"
        style={{
          position: 'absolute', top: 'calc(env(safe-area-inset-top, 0px) + 12px)', left: '50%', transform: 'translateX(-50%)',
          width: 'min(86%, 320px)', pointerEvents: 'none',
          background: 'linear-gradient(180deg, rgba(28,22,42,0.82), rgba(16,12,26,0.82))',
          backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
          border: '1px solid rgba(244,199,123,0.22)',
          borderRadius: 18, padding: '9px 14px',
          boxShadow: '0 10px 30px -12px rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', gap: 11,
        }}
      >
        <span aria-hidden style={{ fontSize: 19, filter: `drop-shadow(0 0 8px rgba(255,203,94,${0.3 + 0.5 * pct / 100}))` }}>💛</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
            <span className="fs-mono" style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(244,199,123,0.85)' }}>
              {t.ruins_hud_heart || 'Heart'}
            </span>
            <span className="fs-mono" style={{ fontSize: 11, fontWeight: 800, color: '#FFE7B0' }}>
              {interp(t.ruins_restored_count || '{sealed}/{total} restored', { sealed, total })}
            </span>
          </div>
          <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${pct}%`, borderRadius: 999,
              background: 'linear-gradient(90deg, #E8965A, #FFCB5E)',
              boxShadow: '0 0 10px rgba(255,203,94,0.6)',
              transition: 'width 0.6s cubic-bezier(0.16,1,0.3,1)',
            }} />
          </div>
        </div>
        <span className="fs-display" style={{ fontSize: 15, fontWeight: 800, color: '#FFE7B0', fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
      </div>

      {/* ── First-run control hint ───────────────────────────── */}
      {showHint && (
        <div
          onClick={() => setShowHint(false)}
          className="fs-sans a-fade-in"
          style={{
            position: 'absolute', inset: 0, zIndex: 5,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 14, textAlign: 'center', padding: 32,
            background: 'radial-gradient(circle at 50% 46%, rgba(10,8,20,0.35), rgba(8,6,16,0.78))',
            cursor: 'pointer',
          }}
        >
          <div aria-hidden className="a-tap-press" style={{
            width: 64, height: 64, borderRadius: '50%',
            border: '2px solid rgba(244,199,123,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
            background: 'rgba(244,199,123,0.12)',
            boxShadow: '0 0 30px rgba(244,199,123,0.25)',
          }}>👆</div>
          <div className="fs-display" style={{ fontSize: 19, fontWeight: 800, color: '#FBFAF6' }}>
            {t.ruins_onboard_move || 'Drag to explore the dark'}
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.5, color: 'rgba(251,250,246,0.72)', maxWidth: 250 }}>
            {t.ruins_onboard_goal || 'Your lantern lights the ruins. Reach a glowing marker to investigate what happened there.'}
          </div>
        </div>
      )}

      {/* ── Investigate prompt — bespoke, warm, lifted ───────── */}
      {prompt && (
        <button
          onClick={handleEnter}
          className="a-pop-in press"
          style={{
            position: 'absolute', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 26px)', left: '50%', transform: 'translateX(-50%)',
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '11px 20px 11px 12px', borderRadius: 999, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(180deg, #FFE7B0, #F4B45A)', color: '#3A2A12',
            fontFamily: 'inherit', fontWeight: 800, fontSize: 16,
            boxShadow: '0 8px 0 #B57D32, 0 18px 34px -8px rgba(244,180,90,0.7)',
          }}
        >
          <span aria-hidden style={{
            width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
            background: 'rgba(58,42,18,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 21,
          }}>{prompt.emoji}</span>
          <span style={{ paddingInlineEnd: 6 }}>{prompt.label}</span>
        </button>
      )}
    </div>
  );
}

// Lighten/darken a hex colour by `amt` (−1…1). Used for district depth.
function shade(hex, amt) {
  const h = hex.replace('#', '');
  const n = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  let r = parseInt(n.slice(0, 2), 16), g = parseInt(n.slice(2, 4), 16), b = parseInt(n.slice(4, 6), 16);
  const f = amt < 0 ? 1 + amt : 1;
  const add = amt > 0 ? 255 * amt : 0;
  r = Math.round(r * f + add); g = Math.round(g * f + add); b = Math.round(b * f + add);
  const c = (v) => clamp(v, 0, 255).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}
