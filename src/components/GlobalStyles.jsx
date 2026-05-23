export default function GlobalStyles() {
  return (
    <style>{`
      @font-face {
        font-family: 'Rubik Black';
        src: url('/fonts/RubikBlack.ttf') format('truetype');
        font-weight: 900;
        font-style: normal;
        font-display: swap;
        unicode-range: U+0590-05FF, U+FB1D-FB4F, U+200F, U+200E;
      }
      @font-face {
        font-family: 'Comix CLM';
        src: url('/fonts/comixno2clm_medium-webfont.woff') format('woff'),
             url('/fonts/comixno2clm_medium-webfont.ttf') format('truetype');
        font-weight: 300 600;
        font-style: normal;
        font-display: swap;
        unicode-range: U+0590-05FF, U+FB1D-FB4F, U+200F, U+200E;
      }
      @font-face {
        font-family: 'Comix CLM';
        src: url('/fonts/comixno2clm_bold-webfont.woff') format('woff'),
             url('/fonts/comixno2clm_bold-webfont.ttf') format('truetype');
        font-weight: 700 900;
        font-style: normal;
        font-display: swap;
        unicode-range: U+0590-05FF, U+FB1D-FB4F, U+200F, U+200E;
      }
      .fs-display { font-family: 'Bricolage Grotesque', 'Rubik Black', 'Comix CLM', serif; }
      .fs-mono { font-family: 'Inter Tight', 'DM Sans', 'Comix CLM', -apple-system, sans-serif; font-feature-settings: 'tnum' on; font-variant-numeric: tabular-nums; font-weight: 500; }
      .fs-sans { font-family: 'DM Sans', 'Comix CLM', -apple-system, sans-serif; }
      @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes scaleSpring { 0% { opacity: 0; transform: scale(0.5); } 60% { transform: scale(1.08); } 100% { opacity: 1; transform: scale(1); } }
      @keyframes scaleIn { from { opacity: 0; transform: scale(0.85); } to { opacity: 1; transform: scale(1); } }
      @keyframes slideRight { from { opacity: 0; transform: translateX(-30px); } to { opacity: 1; transform: translateX(0); } }
      @keyframes slideUpFar { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes spin360 { to { transform: rotate(360deg); } }
      @keyframes pulseGlow {
        0%, 100% { filter: drop-shadow(0 0 14px rgba(249,199,79,0.45)); }
        50% { filter: drop-shadow(0 0 30px rgba(249,199,79,0.9)); }
      }
      @keyframes floatUp {
        0% { opacity: 0; transform: translateY(20px) scale(0.6); }
        20% { opacity: 1; transform: translateY(0) scale(1); }
        100% { opacity: 0; transform: translateY(-80px) scale(0.8); }
      }
      @keyframes barGrow { from { transform: scaleY(0); } to { transform: scaleY(1); } }
      @keyframes shineMove {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }
      @keyframes shakeScreen {
        0%, 100% { transform: translate(0, 0); }
        10% { transform: translate(-3px, 1px); }
        20% { transform: translate(3px, -2px); }
        30% { transform: translate(-2px, 2px); }
        40% { transform: translate(2px, 1px); }
        50% { transform: translate(-1px, -1px); }
        60% { transform: translate(1px, 2px); }
        70% { transform: translate(-2px, 1px); }
        80% { transform: translate(2px, -1px); }
        90% { transform: translate(-1px, 1px); }
      }
      @keyframes notifRain {
        0% { opacity: 0; transform: translateY(-30px); }
        15% { opacity: 1; }
        85% { opacity: 1; }
        100% { opacity: 0; transform: translateY(280px); }
      }
      @keyframes orbit {
        0% { transform: rotate(0deg) translateX(60px) rotate(0deg); }
        100% { transform: rotate(360deg) translateX(60px) rotate(-360deg); }
      }
      @keyframes ringPulse {
        0% { transform: scale(0.6); opacity: 0.8; }
        100% { transform: scale(1.6); opacity: 0; }
      }
      @keyframes roastIn {
        0% { opacity: 0; transform: translateY(50px) scale(0.85) rotate(-2deg); }
        50% { transform: translateY(-6px) scale(1.04) rotate(1deg); }
        70% { transform: translateY(2px) scale(0.98) rotate(0deg); }
        100% { opacity: 1; transform: translateY(0) scale(1) rotate(0deg); }
      }
      @keyframes gradientShift {
        0%, 100% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
      }
      @keyframes wobble {
        0%, 100% { transform: rotate(-2deg); }
        50% { transform: rotate(2deg); }
      }
      @keyframes popIn {
        0% { opacity: 0; transform: scale(0.3); }
        70% { transform: scale(1.15); }
        100% { opacity: 1; transform: scale(1); }
      }
      @keyframes shimmerFlash {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.6; }
      }
      @keyframes blobDrift1 {
        0%, 100% { transform: translate(0px, 0px) scale(1); }
        33% { transform: translate(40px, -30px) scale(1.08); }
        66% { transform: translate(-20px, 20px) scale(0.96); }
      }
      @keyframes blobDrift2 {
        0%, 100% { transform: translate(0px, 0px) scale(1); }
        40% { transform: translate(-35px, 25px) scale(1.06); }
        70% { transform: translate(25px, -15px) scale(0.94); }
      }
      @keyframes blobDrift3 {
        0%, 100% { transform: translate(0px, 0px) scale(1); }
        30% { transform: translate(20px, 30px) scale(1.1); }
        60% { transform: translate(-30px, -20px) scale(0.92); }
      }
      .slide-content { color: #2a0645; }
      .slide-content * { text-shadow: 0 1px 8px rgba(255,255,255,0.8); }
      .a-fade-up { animation: fadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) both; }
      .a-fade-in { animation: fadeIn 0.6s ease-out both; }
      .a-scale-in { animation: scaleIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) both; }
      .a-spring { animation: scaleSpring 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
      .a-slide-right { animation: slideRight 0.5s cubic-bezier(0.16, 1, 0.3, 1) both; }
      .a-slide-up-far { animation: slideUpFar 0.7s cubic-bezier(0.16, 1, 0.3, 1) both; }
      .a-spin { animation: spin360 0.8s linear infinite; }
      .a-pulse-glow { animation: pulseGlow 2.5s ease-in-out infinite; }
      .a-float { animation: floatUp 2.8s ease-out infinite; }
      .a-bar { animation: barGrow 0.8s cubic-bezier(0.16, 1, 0.3, 1) both; transform-origin: bottom; }
      .a-shake { animation: shakeScreen 0.5s ease-in-out infinite; }
      .a-roast-card { animation: roastIn 0.9s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
      .a-wobble { animation: wobble 3s ease-in-out infinite; }
      .a-pop-in { animation: popIn 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
      .a-gradient-shift {
        background-size: 200% 200%;
        animation: gradientShift 6s ease-in-out infinite;
      }
      .a-shimmer-flash { animation: shimmerFlash 1.4s ease-in-out infinite; }
      .a-shine {
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent);
        background-size: 200% 100%;
        animation: shineMove 2.2s linear infinite;
      }
      @keyframes slideEnterRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
      @keyframes slideEnterLeft  { from { transform: translateX(-100%); } to { transform: translateX(0); } }
      .slide-in-right { animation: slideEnterRight 350ms cubic-bezier(0.4, 0, 0.2, 1) both; }
      .slide-in-left  { animation: slideEnterLeft  350ms cubic-bezier(0.4, 0, 0.2, 1) both; }
      .slide-content  { animation: fadeIn 0.4s ease 0.12s both; }
      .no-sb::-webkit-scrollbar { display: none; }
      .no-sb { scrollbar-width: none; }
      .press { transition: transform 0.1s; }
      .press:active { transform: scale(0.94); }
      .lift { transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s; }
      .lift:active { transform: scale(0.97) translateY(2px); }
      .cw-frame * { box-sizing: border-box; }

      /* ===== Ultra-Pop "Roast Cards" — high-contrast, rounded, floating ===== */
      .roast-card {
        background: var(--card-bg);
        color: #fff;
        border-radius: 28px;
        padding: 20px 22px;
        border: 3px solid rgba(255,255,255,0.07);
        box-shadow: 0 10px 0 rgba(74,14,78,0.22), 0 22px 45px -8px rgba(74,14,78,0.45);
      }
      .roast-card.is-navy {
        background: var(--card-bg-alt);
        box-shadow: 0 10px 0 rgba(10,25,47,0.25), 0 22px 45px -8px rgba(10,25,47,0.5);
      }
      .roast-card.is-floating { animation: popFloat 4.5s ease-in-out infinite; }
      @keyframes popFloat {
        0%, 100% { transform: translateY(0) rotate(-0.6deg); }
        50%      { transform: translateY(-9px) rotate(0.6deg); }
      }

      /* ===== Ultra-Pop CTA buttons — chunky, game-UI press ===== */
      .pop-btn {
        display: inline-flex; align-items: center; justify-content: center; gap: 8px;
        background: var(--cta); color: var(--ink-alt);
        border: none; border-radius: 999px;
        padding: 15px 30px; font-weight: 800; font-size: 17px;
        cursor: pointer; -webkit-tap-highlight-color: transparent;
        box-shadow: 0 6px 0 rgba(0,0,0,0.2), 0 12px 26px -4px rgba(0,191,255,0.5);
        transition: transform 0.08s ease, box-shadow 0.08s ease;
      }
      .pop-btn.is-pink {
        background: var(--cta-2); color: #fff;
        box-shadow: 0 6px 0 rgba(0,0,0,0.2), 0 12px 26px -4px rgba(255,105,180,0.5);
      }
      .pop-btn:active {
        transform: translateY(4px);
        box-shadow: 0 2px 0 rgba(0,0,0,0.2), 0 6px 14px -4px rgba(0,0,0,0.35);
      }

      /* Keyboard focus indicator — does not appear on mouse/touch click. */
      .cw-frame :focus { outline: none; }
      .cw-frame :focus-visible {
        outline: 2px solid #f9c74f;
        outline-offset: 2px;
        border-radius: 4px;
      }
      .cw-frame button:focus-visible,
      .cw-frame [role="button"]:focus-visible {
        outline: 2px solid #f9c74f;
        outline-offset: 3px;
        box-shadow: 0 0 0 4px rgba(249,199,79,0.18);
      }

      /* Respect reduced-motion preference: stop infinite/decorative animations. */
      @media (prefers-reduced-motion: reduce) {
        .a-pulse-glow, .a-spin, .a-shine, .a-shimmer-flash,
        .a-gradient-shift, .a-shake, .a-wobble, .a-float {
          animation: none !important;
        }
        .a-fade-up, .a-fade-in, .a-scale-in, .a-spring,
        .a-slide-right, .a-slide-up-far, .a-bar,
        .a-pop-in, .a-roast-card,
        .slide-in-right, .slide-in-left, .slide-content {
          animation-duration: 0.001ms !important;
          animation-delay: 0ms !important;
        }
        * { transition-duration: 0.001ms !important; }
      }
    `}</style>
  );
}
