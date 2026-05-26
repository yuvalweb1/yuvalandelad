// ============================================================
// Ad configuration — central place to control ad slots.
// ------------------------------------------------------------
// The app is privacy-first ("nothing leaves your device, no network").
// So ad slots render as PLACEHOLDERS by default and make no network call.
//
// To show a real ad, set `render` below to return a React node:
//   • Self-hosted / sponsor (privacy-safe): return an <a><img …/></a> using
//     an asset you bundle — no third-party request, privacy promise intact.
//   • Network ad (Google AdSense / AdMob, etc.): inject their unit here —
//     ⚠️ this makes a network request and tracks the user, which BREAKS the
//     "nothing leaves your device" claim in the README / Verify screen.
//     Update that copy (and add consent) before enabling a network ad.
//
// Toggle individual placements in `slots`. `enabled` is the master switch.
// ============================================================

export const ADS = {
  enabled: true,
  slots: {
    menu: true,           // banner on the post-Wrapped menu (visible by default)
    landing: false,       // banner on the home screen
    interstitial: false,  // full-screen ad slide inside the Wrapped story
    post_parse: true,     // full-screen video ad right after parsing, before Onboarding
    pre_wrapped: true,    // full-screen video ad before the slides start
    pre_menu: true,       // full-screen video ad after slides, before PostMenu
    pre_roast: true,      // full-screen video ad before RoastMode opens
  },
  // Default seconds the user must wait before the skip button activates on a
  // video ad slot. Per-slot override allowed via the `skipAfter` map below.
  skipAfter: {
    post_parse: 5,
    pre_wrapped: 5,
    pre_menu: 5,
    pre_roast: 5,
  },
  // ({ slot, format }) => React node | null.  Return null to keep the placeholder.
  render: null,
};

/** Whether a given placement should show (master switch AND per-slot toggle). */
export function adEnabled(slot) {
  return !!(ADS.enabled && ADS.slots[slot]);
}
