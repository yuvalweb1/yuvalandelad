// ============================================================
// RunCanvas — the runner engine for The Long Run.
// One canvas, one rAF loop, fixed-step physics. React renders
// this component once per run; the hot path never re-renders.
// All gameplay state lives in refs/closures. Events bubble up
// via callbacks (capsule found / finished / dead / stats).
// No Math.random(): cosmetic particles use a seeded PRNG.
// ============================================================
import { useRef, useEffect } from 'react';
import { PHYS } from './levelGen.js';
import { mulberry32 } from './rng.js';

const PLAYER_COLOR = '#ffd166';
const PARTNER_COLOR = '#7cc4ff';
const HAZARD_EMOJI = { block: '🚧', ghost: '👻', bat: '🦇' };

export default function RunCanvas({
  level, playerName, partnerName, trailColor = '#f9c74f',
  doubleJump = false, paused = false, reducedMotion = false, isRTL = false,
  labels = {}, onCapsule, onFinish, onDead, onQuit,
}) {
  const canvasRef = useRef(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const cbRef = useRef({});
  cbRef.current = { onCapsule, onFinish, onDead };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !level) return;
    const ctx = canvas.getContext('2d');
    // roundRect landed in Safari 16 / Chrome 99 — soft-fallback for older WebViews.
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
    const cosmetic = mulberry32(0xC0FFEE ^ level.idx); // visuals only

    // ── View ───────────────────────────────────────────────
    const view = { w: PHYS.W, h: PHYS.H, scale: 1 };
    function resize() {
      const parent = canvas.parentElement;
      if (!parent) return;
      const cssW = parent.clientWidth, cssH = parent.clientHeight;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      canvas.style.width = cssW + 'px';
      canvas.style.height = cssH + 'px';
      view.scale = (cssW / PHYS.W) * dpr;
      view.h = canvas.height / view.scale;
      // Keep terrain in the lower 2/3 on tall screens.
      view.groundShift = Math.max(0, (view.h - PHYS.H) * 0.6);
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement);

    // ── World state ────────────────────────────────────────
    const start = level.platforms[0];
    const p = {
      x: 90, y: start.y - PHYS.PLAYER_R, vy: 0,
      onGround: true, jumps: 0, holding: false,
      coyote: 0, buffer: 0, inv: 0, squash: 0,
    };
    let t = 0, cam = 0, hearts = 3, coins = 0, combo = 0, comboBest = 0;
    let meter = 0, magnet = 0, shake = 0, flash = 0;
    let finished = false, dead = false, capsuleHit = false;
    const coinState = level.coins.map(c => ({ ...c, cx: c.x, cy: c.y, taken: false }));
    const heartState = level.hearts.map(h => ({ ...h, taken: false }));
    const particles = [];
    const floats = [];
    const trail = [];
    let trailClock = 0;

    function burst(x, y, color, n = 6) {
      if (reducedMotion) n = 2;
      for (let i = 0; i < n; i++) {
        const a = cosmetic() * Math.PI * 2, s = 60 + cosmetic() * 120;
        particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, life: 0.55, color });
      }
    }
    function floatText(x, y, txt, color) {
      floats.push({ x, y, txt, color, life: 0.9 });
    }

    function doJump() {
      p.vy = -PHYS.JUMP_V;
      p.onGround = false;
      p.coyote = 0; p.buffer = 0;
      burst(p.x, p.y + 12, 'rgba(255,255,255,0.5)', 4);
    }

    function loseHeart(fell) {
      hearts--; combo = 0; meter = Math.max(0, meter - 4);
      floatText(p.x - 60, p.y - 46, 'COMBO BROKEN', '#fb7185');
      flash = 0.35; shake = reducedMotion ? 0 : 0.3;
      try { navigator.vibrate && navigator.vibrate(30); } catch {}
      if (hearts <= 0) {
        dead = true;
        setTimeout(() => cbRef.current.onDead?.({ coins, comboBest }), 350);
        return;
      }
      p.inv = 1.4;
      if (fell) {
        // Respawn on the next platform ahead — keep the flow going.
        const next = level.platforms.find(pl => !pl.float && pl.x + pl.w > p.x + 40) || start;
        p.x = Math.max(p.x, next.x + 40);
        p.y = next.y - 90; p.vy = 0;
      } else {
        p.vy = -360;
      }
    }

    // ── Input ──────────────────────────────────────────────
    function press(e) { e.preventDefault(); p.holding = true; p.buffer = 0.12; }
    function release() { p.holding = false; if (p.vy < -200) p.vy = -200; }
    function key(e) {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        if (e.type === 'keydown' && !e.repeat) { p.holding = true; p.buffer = 0.12; }
        if (e.type === 'keyup') release();
      }
    }
    canvas.addEventListener('pointerdown', press);
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);
    window.addEventListener('keydown', key);
    window.addEventListener('keyup', key);

    // ── Physics step ───────────────────────────────────────
    const maxJumps = doubleJump ? 2 : 1;
    function step(dt) {
      t += dt;
      const inStorm = level.storm && p.x > level.storm.x0 && p.x < level.storm.x1;
      const prog = Math.min(1, p.x / level.worldLen);
      const speed = level.speed * (1 + 0.16 * prog) * (inStorm ? 1.08 : 1);
      p.x += speed * dt;

      // Jump (buffer + coyote + optional double)
      if (p.buffer > 0) {
        if (p.onGround || p.coyote > 0) { doJump(); p.jumps = 1; }
        else if (p.jumps < maxJumps) { doJump(); p.jumps++; burst(p.x, p.y + 14, trailColor, 6); }
      }

      // Gravity (hold = lower gravity while rising → higher jump)
      const g = (p.holding && p.vy < 0) ? PHYS.GRAVITY_HOLD : PHYS.GRAVITY;
      p.vy += g * dt;
      p.y += p.vy * dt;

      // Land on platforms
      const wasGround = p.onGround;
      p.onGround = false;
      if (p.vy >= 0) {
        const feet = p.y + PHYS.PLAYER_R;
        const prevFeet = feet - p.vy * dt;
        for (const pl of level.platforms) {
          if (p.x < pl.x - 6 || p.x > pl.x + pl.w + 6) continue;
          const top = pl.y + (pl.float ? Math.sin(t * 1.6 + pl.x) * 3 : 0);
          if (feet >= top && prevFeet <= top + 14) {
            p.y = top - PHYS.PLAYER_R; p.vy = 0;
            p.onGround = true; p.jumps = 0;
            if (!wasGround) { p.squash = 0.22; burst(p.x, top, 'rgba(255,255,255,0.35)', 3); }
            break;
          }
        }
      }
      if (wasGround && !p.onGround) p.coyote = 0.09;

      // Fell into a silence (fixed world-space threshold below the
      // lowest ground line, independent of screen height)
      if (p.y - PHYS.PLAYER_R > 640) loseHeart(true);

      // Hazards
      if (p.inv <= 0 && !dead) {
        for (const h of level.hazards) {
          if (Math.abs(h.x - p.x) > 50) continue;
          let hx = h.x, hy, hr;
          if (h.type === 'bat') { hy = h.baseY + Math.sin(t * h.freq + h.x * 0.01) * h.amp; hr = 15; }
          else if (h.type === 'ghost') { hy = h.y + Math.sin(t * 1.3) * h.drift; hr = 16; }
          else { hy = h.y; hr = 14; }
          const dx = hx - p.x, dy = hy - p.y;
          if (dx * dx + dy * dy < (hr + PHYS.PLAYER_R - 5) ** 2) { loseHeart(false); break; }
        }
        if (inStorm && level.storm.drops) {
          for (const d of level.storm.drops) {
            if (Math.abs(d.x - p.x) > 30) continue;
            const dy = ((t * d.speed + d.phase * 680) % 680) - 40; // world-space fall
            const ddx = d.x - p.x, ddy = dy - p.y;
            if (ddx * ddx + ddy * ddy < (10 + PHYS.PLAYER_R - 5) ** 2) { loseHeart(false); break; }
          }
        }
      }

      // Coins (+ partner-assist magnet)
      const reach = magnet > 0 ? 90 : 24;
      for (const c of coinState) {
        if (c.taken) continue;
        const dx = c.cx - p.x, dy = c.cy - p.y;
        const d2 = dx * dx + dy * dy;
        if (magnet > 0 && d2 < 130 * 130) {
          c.cx -= dx * 6 * dt; c.cy -= dy * 6 * dt;
        }
        if (d2 < reach * reach) {
          c.taken = true; coins++; combo++; meter++;
          if (combo > comboBest) comboBest = combo;
          burst(c.cx, c.cy, trailColor, 4);
          floatText(c.cx, c.cy - 12, combo >= 5 ? `+1 ×${combo}` : '+1', '#fff');
          try { navigator.vibrate && navigator.vibrate(6); } catch {}
          if (meter >= 12) { meter = 0; magnet = 4; floatText(p.x, p.y - 46, labels.assist || 'PARTNER ASSIST!', PARTNER_COLOR); }
        }
      }

      // Heart pickups
      for (const h of heartState) {
        if (h.taken) continue;
        const dx = h.x - p.x, dy = h.y - p.y;
        if (dx * dx + dy * dy < 26 * 26) {
          h.taken = true; hearts = Math.min(3, hearts + 1);
          floatText(h.x, h.y - 14, '+❤️', '#fb7185');
        }
      }

      // Memory capsule
      if (!capsuleHit && level.capsule) {
        const cr = level.capsule.r || 30;
        const dx = level.capsule.x - p.x, dy = level.capsule.y - p.y;
        if (dx * dx + dy * dy < cr * cr) {
          capsuleHit = true;
          burst(level.capsule.x, level.capsule.y, '#f9c74f', 14);
          try { navigator.vibrate && navigator.vibrate([20, 40, 20]); } catch {}
          cbRef.current.onCapsule?.();
        }
      }

      // Finish gate
      if (!finished && p.x >= level.finishX) {
        finished = true;
        setTimeout(() => cbRef.current.onFinish?.({
          coins, comboBest, hearts, capsule: capsuleHit,
        }), 250);
      }

      // Timers
      p.coyote = Math.max(0, p.coyote - dt);
      p.buffer = Math.max(0, p.buffer - dt);
      p.inv = Math.max(0, p.inv - dt);
      p.squash = Math.max(0, p.squash - dt * 1.6);
      magnet = Math.max(0, magnet - dt);
      shake = Math.max(0, shake - dt);
      flash = Math.max(0, flash - dt);

      // Trail + particles
      trailClock += dt;
      if (trailClock > 0.03) {
        trailClock = 0;
        trail.push({ x: p.x, y: p.y, life: 0.4 });
        if (trail.length > 16) trail.shift();
      }
      for (const tr of trail) tr.life -= dt;
      for (let i = particles.length - 1; i >= 0; i--) {
        const pt = particles[i];
        pt.life -= dt; pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vy += 500 * dt;
        if (pt.life <= 0) particles.splice(i, 1);
      }
      for (let i = floats.length - 1; i >= 0; i--) {
        floats[i].life -= dt; floats[i].y -= 36 * dt;
        if (floats[i].life <= 0) floats.splice(i, 1);
      }

      cam = p.x - 92;
    }

    // ── Render ─────────────────────────────────────────────
    const pal = level.palette;
    const stars = [];
    for (let i = 0; i < 40; i++) stars.push({ x: cosmetic() * PHYS.W, y: cosmetic() * 300, r: 0.6 + cosmetic() * 1.2, tw: cosmetic() * 6 });

    function hill(offset, speedF, amp, baseY, color) {
      ctx.fillStyle = color;
      ctx.beginPath();
      const ox = cam * speedF + offset;
      ctx.moveTo(0, view.h);
      for (let sx = 0; sx <= PHYS.W + 20; sx += 20) {
        const wx = sx + ox;
        const yy = baseY + view.groundShift + Math.sin(wx * 0.008) * amp + Math.sin(wx * 0.021 + 2) * amp * 0.4;
        ctx.lineTo(sx, yy);
      }
      ctx.lineTo(PHYS.W, view.h);
      ctx.closePath();
      ctx.fill();
    }

    function render() {
      ctx.direction = 'ltr';
      ctx.setTransform(view.scale, 0, 0, view.scale, 0, 0);
      const gs = view.groundShift || 0;
      const inStorm = level.storm && p.x > level.storm.x0 && p.x < level.storm.x1;

      // Screen shake
      if (shake > 0 && !reducedMotion) {
        ctx.translate((cosmetic() - 0.5) * shake * 14, (cosmetic() - 0.5) * shake * 14);
      }

      // Sky
      const sky = ctx.createLinearGradient(0, 0, 0, view.h);
      sky.addColorStop(0, pal.skyTop); sky.addColorStop(1, pal.skyBot);
      ctx.fillStyle = sky;
      ctx.fillRect(-10, -10, PHYS.W + 20, view.h + 20);

      // Stars / moon on night levels
      if (pal.night) {
        ctx.fillStyle = '#dfe6ff';
        for (const s of stars) {
          ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * 0.8 + s.tw));
          ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 7); ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.font = '34px serif'; ctx.fillText('🌙', 296, 128); // below the HUD row
      }

      // Parallax hills
      hill(0, -0.25, 26, 330, pal.hill);
      hill(400, -0.5, 34, 380, pal.ground);

      ctx.save();
      ctx.translate(-cam, gs);

      // Platforms
      for (const pl of level.platforms) {
        if (pl.x + pl.w < cam - 20 || pl.x > cam + PHYS.W + 20) continue;
        const top = pl.y + (pl.float ? Math.sin(t * 1.6 + pl.x) * 3 : 0);
        ctx.fillStyle = pal.ground;
        if (pl.float) {
          ctx.beginPath(); ctx.roundRect(pl.x, top, pl.w, 18, 9); ctx.fill();
        } else {
          ctx.fillRect(pl.x, top, pl.w, view.h - top + 40);
        }
        ctx.fillStyle = pal.edge;
        ctx.globalAlpha = 0.9;
        ctx.beginPath(); ctx.roundRect(pl.x, top - 2, pl.w, 4, 2); ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Tutorial signpost (level 1)
      if (level.signpost) {
        ctx.font = '700 12px sans-serif';
        const hintText = labels.hint || 'TAP = JUMP · HOLD = HIGHER';
        const textWidth = ctx.measureText(hintText).width;
        const boxPadding = 18;
        const boxWidth = Math.min(Math.max(textWidth + boxPadding * 2, 160), PHYS.W - 40);
        const boxX = Math.max(20, Math.min(PHYS.W / 2 - boxWidth / 2, PHYS.W - boxWidth - 20));
        ctx.fillStyle = 'rgba(255,255,255,0.16)';
        ctx.beginPath(); ctx.roundRect(boxX, start.y - 64, boxWidth, 34, 8); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
        ctx.fillText(hintText, boxX + boxWidth / 2, start.y - 42);
        ctx.textAlign = 'start';
      }

      // Finish gate
      const fx = level.finishX;
      if (fx > cam - 40 && fx < cam + PHYS.W + 60) {
        const gy = level.platforms[level.platforms.length - 1].y;
        ctx.fillStyle = pal.edge; ctx.fillRect(fx, gy - 96, 4, 96);
        ctx.font = '26px serif'; ctx.fillText('🏁', fx + 6, gy - 72);
        ctx.globalAlpha = 0.25 + 0.15 * Math.sin(t * 3);
        ctx.fillStyle = pal.edge;
        ctx.beginPath(); ctx.roundRect(fx - 26, gy - 100, 60, 104, 12); ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Coins
      ctx.font = '19px serif'; ctx.textAlign = 'center';
      for (const c of coinState) {
        if (c.taken || c.cx < cam - 30 || c.cx > cam + PHYS.W + 30) continue;
        ctx.fillText(c.emoji, c.cx, c.cy + Math.sin(t * 3 + c.x * 0.05) * 3 + 7);
      }

      // Heart pickups
      ctx.font = '22px serif';
      for (const h of heartState) {
        if (h.taken || h.x < cam - 30 || h.x > cam + PHYS.W + 30) continue;
        const pulse = 1 + 0.12 * Math.sin(t * 4);
        ctx.save(); ctx.translate(h.x, h.y); ctx.scale(pulse, pulse);
        ctx.fillText('❤️', 0, 8); ctx.restore();
      }

      // Capsule
      if (!capsuleHit && level.capsule) {
        const cx = level.capsule.x, cy = level.capsule.y + Math.sin(t * 2) * 4;
        if (cx > cam - 40 && cx < cam + PHYS.W + 40) {
          ctx.globalAlpha = 0.35 + 0.2 * Math.sin(t * 2.6);
          ctx.fillStyle = '#f9c74f';
          ctx.beginPath(); ctx.arc(cx, cy, 26 + Math.sin(t * 2.6) * 4, 0, 7); ctx.fill();
          ctx.globalAlpha = 1;
          ctx.font = '26px serif'; ctx.fillText('💌', cx, cy + 9);
        }
      }

      // Hazards
      for (const h of level.hazards) {
        if (h.x < cam - 40 || h.x > cam + PHYS.W + 40) continue;
        let hy = h.y;
        if (h.type === 'bat') hy = h.baseY + Math.sin(t * h.freq + h.x * 0.01) * h.amp;
        if (h.type === 'ghost') hy = h.y + Math.sin(t * 1.3) * h.drift;
        ctx.font = h.type === 'bat' ? '24px serif' : '26px serif';
        if (h.type === 'ghost') { ctx.globalAlpha = 0.85; }
        ctx.fillText(HAZARD_EMOJI[h.type] || '🚧', h.x, hy + 10);
        ctx.globalAlpha = 1;
      }

      // Storm rain
      if (inStorm && level.storm.drops) {
        ctx.font = '16px serif';
        ctx.globalAlpha = 0.9;
        for (const d of level.storm.drops) {
          if (d.x < cam - 20 || d.x > cam + PHYS.W + 20) continue;
          const dy = ((t * d.speed + d.phase * 680) % 680) - 40; // matches hitbox
          ctx.fillText('✉️', d.x, dy);
        }
        ctx.globalAlpha = 1;
      }

      // The stalker (great-silence levels): a ghost rides the screen edge
      if (level.stalker && !dead) {
        ctx.globalAlpha = 0.55 + 0.2 * Math.sin(t * 1.8);
        ctx.font = '40px serif';
        ctx.fillText('👻', cam + 28, p.y + Math.sin(t * 1.4) * 14 + 6);
        ctx.globalAlpha = 1;
      }

      // Trail
      for (let i = 0; i < trail.length; i++) {
        const tr = trail[i];
        if (tr.life <= 0) continue;
        ctx.globalAlpha = tr.life * 0.5;
        ctx.fillStyle = trailColor;
        ctx.beginPath(); ctx.arc(tr.x, tr.y, 3 + i * 0.35, 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Companion (the partner runs with you)
      const compX = p.x - 36, compY = p.y - 22 + Math.sin(t * 2.4) * 7;
      if (magnet > 0) {
        ctx.globalAlpha = 0.25 + 0.1 * Math.sin(t * 6);
        ctx.strokeStyle = PARTNER_COLOR; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(p.x, p.y, 88, 0, 7); ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = PARTNER_COLOR;
      ctx.beginPath(); ctx.arc(compX, compY, 9, 0, 7); ctx.fill();
      ctx.fillStyle = '#0d1126'; ctx.font = '700 9px sans-serif';
      ctx.fillText((partnerName || '?')[0].toUpperCase(), compX, compY + 3);

      // Player (squash & stretch + invincibility blink)
      const blink = p.inv > 0 && Math.floor(t * 14) % 2 === 0;
      if (!blink && !dead) {
        const sx = 1 + p.squash, sy = 1 - p.squash;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(Math.max(-0.25, Math.min(0.25, p.vy / 2600)));
        ctx.scale(sx, sy);
        const grad = ctx.createRadialGradient(-4, -5, 2, 0, 0, PHYS.PLAYER_R + 2);
        grad.addColorStop(0, '#fff3d6'); grad.addColorStop(1, PLAYER_COLOR);
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(0, 0, PHYS.PLAYER_R, 0, 7); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = '#1c1830'; ctx.font = '800 13px sans-serif';
        ctx.fillText((playerName || '?')[0].toUpperCase(), 0, 4.5);
        ctx.restore();
      }

      // Particles + float texts
      for (const pt of particles) {
        ctx.globalAlpha = Math.max(0, pt.life * 1.8);
        ctx.fillStyle = pt.color;
        ctx.beginPath(); ctx.arc(pt.x, pt.y, 2.4, 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.font = '700 13px sans-serif';
      for (const f of floats) {
        ctx.globalAlpha = Math.min(1, f.life * 2);
        ctx.fillStyle = f.color;
        ctx.fillText(f.txt, f.x, f.y);
      }
      ctx.globalAlpha = 1;
      ctx.textAlign = 'start';

      ctx.restore();

      // Storm tint + warning
      if (inStorm) {
        ctx.fillStyle = 'rgba(255,90,60,0.07)';
        ctx.fillRect(0, 0, PHYS.W, view.h);
      }
      // Damage flash
      if (flash > 0) {
        ctx.fillStyle = `rgba(251,113,133,${flash * 0.7})`;
        ctx.fillRect(0, 0, PHYS.W, view.h);
      }

      // ── HUD ─────────────────────────────────────────────
      const safeTop = 104;
      // Hearts (always on the left)
      ctx.font = '17px serif';
      for (let i = 0; i < 3; i++) ctx.fillText(i < hearts ? '❤️' : '🖤', 14 + i * 22, safeTop);
      // Coins (right in LTR, left in RTL)
      ctx.font = '15px serif';
      if (isRTL) {
        ctx.textAlign = 'start';
        ctx.fillText(coinState[0]?.emoji || '✨', 14, safeTop);
        ctx.fillStyle = '#fff'; ctx.font = '800 16px sans-serif';
        ctx.fillText(`${coins}`, 32, safeTop);
      } else {
        ctx.textAlign = 'end';
        ctx.fillStyle = '#fff'; ctx.font = '800 16px sans-serif';
        ctx.fillText(`${coins}`, PHYS.W - 36, safeTop);
        ctx.textAlign = 'start';
        ctx.font = '15px serif'; ctx.fillText(coinState[0]?.emoji || '✨', PHYS.W - 30, safeTop);
      }
      // Assist meter (right in LTR, left in RTL)
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      const meterX = isRTL ? 14 : PHYS.W - 80;
      ctx.beginPath(); ctx.roundRect(meterX, safeTop + 18, 66, 5, 3); ctx.fill();
      ctx.fillStyle = PARTNER_COLOR;
      const mw = magnet > 0 ? 66 : (meter / 12) * 66;
      ctx.beginPath(); ctx.roundRect(meterX, safeTop + 18, Math.max(2, mw), 5, 3); ctx.fill();
      // Progress bar (centered)
      const prog = Math.min(1, p.x / level.finishX);
      const barWidth = PHYS.W - 160;
      const barX = (PHYS.W - barWidth) / 2;
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath(); ctx.roundRect(barX, safeTop - 26, barWidth, 5, 3); ctx.fill();
      ctx.fillStyle = pal.edge;
      ctx.beginPath(); ctx.roundRect(barX, safeTop - 26, Math.max(3, barWidth * prog), 5, 3); ctx.fill();
      if (level.capsule && !capsuleHit) {
        const capProg = Math.min(1, level.capsule.x / level.finishX);
        const barWidth = PHYS.W - 160;
        const barX = (PHYS.W - barWidth) / 2;
        ctx.font = '11px serif';
        ctx.fillText('💌', barX + barWidth * capProg, safeTop - 30);
      }
      // Combo callout
      if (combo >= 5) {
        ctx.textAlign = 'center';
        ctx.fillStyle = trailColor; ctx.font = '800 15px sans-serif';
        ctx.fillText(`×${combo} ${labels.combo || 'COMBO'}`, PHYS.W / 2, safeTop + 36);
        ctx.textAlign = 'start';
      }
    }

    // ── Loop ───────────────────────────────────────────────
    let raf = 0, last = 0, acc = 0;
    const STEP = 1 / 120;
    function frame(now) {
      raf = requestAnimationFrame(frame);
      if (!last) last = now;
      let dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (pausedRef.current || document.hidden || dead || finished) {
        // Keep rendering the frozen frame so overlays sit on a live scene.
        render();
        return;
      }
      acc += dt;
      let n = 0;
      while (acc >= STEP && n < 8) { step(STEP); acc -= STEP; n++; }
      render();
    }
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('pointerdown', press);
      canvas.removeEventListener('pointerup', release);
      canvas.removeEventListener('pointercancel', release);
      window.removeEventListener('keydown', key);
      window.removeEventListener('keyup', key);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, doubleJump, reducedMotion, isRTL]);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', width: '100%', height: '100%', touchAction: 'none' }}
    />
  );
}
