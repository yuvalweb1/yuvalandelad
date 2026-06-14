// ============================================================
// RuinsCanvas — the exploration view for The Ruins of [GroupName].
// Top-down camera-follow over kingdom.world, fog-of-war via a
// visited-cell grid, virtual joystick + WASD/arrows for movement.
// One canvas, one rAF loop (RunCanvas pattern) — React only
// re-renders for the "investigate" prompt, which toggles rarely.
// Quest markers (Heart + cases) render ON TOP of the fog so the
// kingdom's shape stays a mystery while points of interest don't.
// ============================================================
import { useRef, useEffect, useState } from 'react';
import { interp } from '../i18n/index.js';

const VIEW_W = 360;
const CELL = 32;
const LANTERN_R = 90;
const PLAYER_R = 12;
const SPEED = 170; // world px/sec
const JOY_RADIUS = 46;
const FOG_COLOR = 'rgba(18,14,10,0.93)';
const VOID_COLOR = '#2a2118';

const cellKey = (gx, gy) => `${gx},${gy}`;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export default function RuinsCanvas({
  kingdom, initialPlayerPos, initialInk = [], litCaseIds = [],
  heartGlowPct = 0, t, lang, isRTL = false, reducedMotion = false,
  onEnterCase,
}) {
  const canvasRef = useRef(null);
  const [prompt, setPrompt] = useState(null); // { caseId, label } | null
  const stateRef = useRef(null); // { pos, ink } — live snapshot for handoff

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

    // ── Step ───────────────────────────────────────────────
    function step(dt) {
      const v = moveVector();
      if (v.x || v.y) {
        p.x = clamp(p.x + v.x * SPEED * dt, PLAYER_R, WORLD.W - PLAYER_R);
        p.y = clamp(p.y + v.y * SPEED * dt, PLAYER_R, WORLD.H - PLAYER_R);
        markInk();
      }

      const maxCamX = Math.max(0, WORLD.W - VIEW_W);
      const maxCamY = Math.max(0, WORLD.H - view.h);
      const targetX = clamp(p.x - VIEW_W / 2, 0, maxCamX);
      const targetY = clamp(p.y - view.h / 2, 0, maxCamY);
      if (reducedMotion) { cam.x = targetX; cam.y = targetY; }
      else { cam.x += (targetX - cam.x) * 0.15; cam.y += (targetY - cam.y) * 0.15; }

      let best = null, bestD = Infinity;
      for (const c of kingdom.cases) {
        const d = Math.hypot(c.pos.x - p.x, c.pos.y - p.y);
        if (d <= c.triggerRadius && d < bestD) { best = c; bestD = d; }
      }
      if (best?.id !== nearCase?.id) {
        nearCase = best;
        if (!best) setPrompt(null);
        else {
          const lit = litCaseIds.includes(best.id);
          setPrompt({ caseId: best.id, label: lit ? (t.ruins_revisit || 'Revisit case') : (t.ruins_investigate || 'Investigate') });
        }
      }
    }

    // ── Render ─────────────────────────────────────────────
    function worldToScreen(wx, wy) { return { x: wx - cam.x, y: wy - cam.y }; }

    function render() {
      ctx.setTransform(view.scale, 0, 0, view.scale, 0, 0);
      ctx.clearRect(0, 0, VIEW_W, view.h);
      ctx.fillStyle = VOID_COLOR;
      ctx.fillRect(0, 0, VIEW_W, view.h);

      // Districts + landmarks
      for (const d of kingdom.districts) {
        const sx = d.bounds.x - cam.x, sy = d.bounds.y - cam.y;
        if (sx + d.bounds.w < 0 || sx > VIEW_W || sy + d.bounds.h < 0 || sy > view.h) continue;
        ctx.fillStyle = d.palette.ground;
        ctx.beginPath(); ctx.roundRect(sx, sy, d.bounds.w, d.bounds.h, 18); ctx.fill();
        ctx.strokeStyle = d.palette.accent; ctx.lineWidth = 2; ctx.globalAlpha = 0.5;
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.font = '22px serif';
        for (const lm of d.landmarks) {
          const lx = lm.x - cam.x, ly = lm.y - cam.y;
          if (lx < -20 || lx > VIEW_W + 20 || ly < -20 || ly > view.h + 20) continue;
          ctx.fillText(lm.emoji, lx, ly);
        }
        // District label
        if (sy > -20 && sy < view.h) {
          ctx.font = '600 12px sans-serif';
          ctx.fillStyle = 'rgba(255,255,255,0.65)';
          const tx = isRTL ? sx + d.bounds.w - 10 : sx + 10;
          ctx.textAlign = isRTL ? 'end' : 'start';
          ctx.fillText(d.name, clamp(tx, 4, VIEW_W - 4), clamp(sy + 18, 14, view.h - 4));
          ctx.textAlign = 'start';
        }
      }

      // Fog of war: dark overlay with holes for visited cells + lantern
      ctx.save();
      ctx.fillStyle = FOG_COLOR;
      ctx.fillRect(0, 0, VIEW_W, view.h);
      ctx.globalCompositeOperation = 'destination-out';
      const gx0 = Math.max(0, Math.floor(cam.x / CELL) - 1);
      const gx1 = Math.min(gridW - 1, Math.ceil((cam.x + VIEW_W) / CELL) + 1);
      const gy0 = Math.max(0, Math.floor(cam.y / CELL) - 1);
      const gy1 = Math.min(gridH - 1, Math.ceil((cam.y + view.h) / CELL) + 1);
      for (let gy = gy0; gy <= gy1; gy++) {
        for (let gx = gx0; gx <= gx1; gx++) {
          if (!ink.has(cellKey(gx, gy))) continue;
          const sx = gx * CELL + CELL / 2 - cam.x, sy = gy * CELL + CELL / 2 - cam.y;
          ctx.beginPath(); ctx.arc(sx, sy, 26, 0, Math.PI * 2); ctx.fill();
        }
      }
      const ps = worldToScreen(p.x, p.y);
      const grad = ctx.createRadialGradient(ps.x, ps.y, 0, ps.x, ps.y, LANTERN_R);
      grad.addColorStop(0, 'rgba(0,0,0,1)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(ps.x, ps.y, LANTERN_R, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      // The Heart — always visible, glow scales with heartGlowPct
      const hs = worldToScreen(kingdom.heart.pos.x, kingdom.heart.pos.y);
      if (hs.x > -60 && hs.x < VIEW_W + 60 && hs.y > -60 && hs.y < view.h + 60) {
        const pulse = reducedMotion ? 1 : 1 + 0.06 * Math.sin(performance.now() / 500);
        const r = kingdom.heart.radius * pulse;
        const glow = ctx.createRadialGradient(hs.x, hs.y, 0, hs.x, hs.y, r * 1.8);
        const alpha = 0.25 + 0.55 * (heartGlowPct / 100);
        glow.addColorStop(0, `rgba(249,199,79,${alpha})`);
        glow.addColorStop(1, 'rgba(249,199,79,0)');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(hs.x, hs.y, r * 1.8, 0, Math.PI * 2); ctx.fill();
        ctx.font = '36px serif'; ctx.textAlign = 'center';
        ctx.fillText('💛', hs.x, hs.y + 12);
        ctx.textAlign = 'start';
      }

      // Case markers — always visible, lit vs unlit
      for (const c of kingdom.cases) {
        const cs = worldToScreen(c.pos.x, c.pos.y);
        if (cs.x < -40 || cs.x > VIEW_W + 40 || cs.y < -40 || cs.y > view.h + 40) continue;
        const lit = litCaseIds.includes(c.id);
        const r = 22;
        if (lit && !reducedMotion) {
          const pulse = 1 + 0.1 * Math.sin(performance.now() / 400);
          ctx.strokeStyle = 'rgba(249,199,79,0.8)'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(cs.x, cs.y, r * pulse + 4, 0, Math.PI * 2); ctx.stroke();
        } else if (lit) {
          ctx.strokeStyle = 'rgba(249,199,79,0.8)'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(cs.x, cs.y, r + 4, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.globalAlpha = lit ? 1 : 0.55;
        ctx.fillStyle = lit ? 'rgba(249,199,79,0.28)' : 'rgba(255,255,255,0.12)';
        ctx.beginPath(); ctx.arc(cs.x, cs.y, r, 0, Math.PI * 2); ctx.fill();
        ctx.font = '24px serif'; ctx.textAlign = 'center';
        ctx.fillText(c.emoji, cs.x, cs.y + 8);
        ctx.textAlign = 'start';
        ctx.globalAlpha = 1;
      }

      // Player
      ctx.fillStyle = '#f9c74f';
      ctx.beginPath(); ctx.arc(ps.x, ps.y, PLAYER_R, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.5; ctx.stroke();

      // Virtual joystick
      if (joy.active) {
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(joy.ox, joy.oy, JOY_RADIUS, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(joy.cx, joy.cy, 18, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }
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
      render();
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

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%', touchAction: 'none' }} />
      <div
        className="fs-sans"
        style={{
          position: 'absolute', top: 'calc(env(safe-area-inset-top, 0px) + 12px)', left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(27,24,19,0.55)', color: '#FBFAF6', borderRadius: 999, padding: '6px 14px',
          fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, pointerEvents: 'none',
        }}
      >
        <span>💛</span>
        <span>{interp(t.ruins_heart_label || 'Heart {pct}%', { pct: heartGlowPct })}</span>
      </div>
      {prompt && (
        <button
          className="pop-btn a-pop-in press"
          onClick={handleEnter}
          style={{
            position: 'absolute', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)', left: '50%', transform: 'translateX(-50%)',
            minHeight: 44,
          }}
        >
          {prompt.label}
        </button>
      )}
    </div>
  );
}
