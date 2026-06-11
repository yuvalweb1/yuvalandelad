// ============================================================
// AdMob wrapper — thin layer over @capacitor-community/admob.
// ------------------------------------------------------------
// On native platforms, interstitials are shown imperatively (a system
// overlay), bypassing the React-rendered VideoAdSlot/SampleVideoAd.
// On web, every call resolves immediately so the existing placeholder
// flow (VideoAdSlot + SampleVideoAd) is unaffected.
//
// Swap TEST_ID for real AdMob Ad Unit IDs before a Play Store release.
// ============================================================
import { Capacitor } from '@capacitor/core';
import { AdMob, InterstitialAdPluginEvents } from '@capacitor-community/admob';

const IS_NATIVE = Capacitor.isNativePlatform();

// Google's public test interstitial unit — safe to ship during development.
const TEST_ID = 'ca-app-pub-3940256099942544/1033173712';

export const AD_UNIT_IDS = {
  post_parse: TEST_ID,
  pre_wrapped: TEST_ID,
  pre_roast: TEST_ID,
};

let initialized = false;

export async function initAdMob() {
  if (!IS_NATIVE || initialized) return;
  initialized = true;
  await AdMob.initialize({ requestTrackingAuthorization: false });
}

export async function loadInterstitial(slot) {
  if (!IS_NATIVE) return;
  try {
    await AdMob.prepareInterstitial({ adId: AD_UNIT_IDS[slot] });
  } catch {
    // Ad failed to load (no fill, offline, etc.) — the show call below
    // will simply fall through and the caller advances regardless.
  }
}

export async function showInterstitial(slot, onComplete) {
  if (!IS_NATIVE) {
    onComplete?.();
    return;
  }
  const listener = await AdMob.addListener(InterstitialAdPluginEvents.Dismissed, () => {
    listener.remove();
    onComplete?.();
  });
  try {
    await AdMob.showInterstitial();
  } catch {
    listener.remove();
    onComplete?.();
  }
}
