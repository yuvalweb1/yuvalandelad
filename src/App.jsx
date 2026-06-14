import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { parseChat } from './parser/client.js';
import { computeAll } from './lib/analytics.js';
import { generateSampleMedia } from './lib/sample.js';
import { loadHistory, saveRecap, removeRecap, clearHistory, deriveChatName, updateRecapProfile } from './lib/history.js';
import { saveMedia, loadMedia, deleteMedia, clearAllMedia } from './lib/mediaStore.js';
import { saveMessages, loadMessages, deleteMessages, clearAllMessages } from './lib/messageStore.js';
import { filterMessagesByPeriod, makeInRange, previewStatsForPeriod, availablePeriods } from './lib/period.js';
import { RTL_LANGS, detectLang, buildT, I18N } from './i18n';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import GlobalStyles from './components/GlobalStyles.jsx';
import BlobBackground from './components/BlobBackground.jsx';
import RotateLockOverlay from './components/RotateLockOverlay.jsx';
import BottomNavBar from './components/BottomNavBar.jsx';
import HowToGuide from './views/HowToGuide.jsx';
import Welcome from './views/Welcome.jsx';
import Landing from './views/Landing.jsx';
import Parsing from './views/Parsing.jsx';
import Onboarding from './views/Onboarding.jsx';
import Wrapped from './views/Wrapped.jsx';
import VerifyView from './views/VerifyView.jsx';
import RoastMode from './views/RoastMode.jsx';
import Modes from './views/Modes.jsx';
import DuoQuest from './views/DuoQuest.jsx';
import GuessWho from './views/GuessWho.jsx';
import Settings from './views/Settings.jsx';
import VideoAdSlot from './components/VideoAdSlot.jsx';
import PremiumPromo, { shouldShowPromo, markPromoDismissed } from './components/PremiumPromo.jsx';
import PaymentSheet from './components/PaymentSheet.jsx';
import { ADS, adEnabled } from './lib/ads.js';
import { initAdMob, loadInterstitial } from './lib/admob.js';
import { SLIDES_BY_TYPE, SLIDE_COMPONENTS } from './slides';

// ============================================================
// MAIN
// ============================================================

// Attach (period-filtered) media to a computed analytics object. Media items
// carry `.ts`; `makeInRange` keeps everything for the 'all' window and
// fail-opens for items the parser couldn't time-stamp.
function attachMedia(analyticsObj, media, period, messages) {
  if (!analyticsObj) return analyticsObj;
  const m = media || {};
  const inRange = makeInRange(period, messages);
  const photos   = (m.photos   || []).filter(inRange);
  const voice    = (m.voice    || []).filter(inRange);
  const videos   = (m.videos   || []).filter(inRange);
  const stickers = (m.stickers || []).filter(inRange);
  return {
    ...analyticsObj,
    photos, voice, videos, stickers,
    totalPhotoCount: photos.length,
    totalStickerInstances: stickers.reduce((s, x) => s + (x.count || 1), 0),
  };
}

// Revoke every object URL held by a media bundle (covers the full set, not a
// period-filtered subset, so nothing leaks when we swap or drop a session).
function revokeMedia(media) {
  if (!media) return;
  for (const list of [media.photos, media.voice, media.videos, media.stickers]) {
    for (const item of (list || [])) { try { URL.revokeObjectURL(item.url); } catch {} }
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <RecappedApp />
    </ErrorBoundary>
  );
}

function RecappedApp() {
  // First-run flow: welcome questionnaire → how-to-export → home.
  // Returning visitors skip both gates and land on Landing directly.
  const [stage, setStage] = useState(() => {
    try {
      if (!localStorage.getItem('cw_seen_welcome')) return 'welcome';
      if (!localStorage.getItem('cw_seen_guide'))   return 'howto';
      return 'landing';
    } catch { return 'welcome'; }
  });
  // `analytics` is period-filtered (drives the Wrapped deck + Verify).
  // `fullAnalytics` is always all-time (drives the game modes + Onboarding,
  // which are framed as whole-chat experiences). They're equal when period==='all'.
  const [analytics, setAnalytics] = useState(null);
  const [fullAnalytics, setFullAnalytics] = useState(null);
  const [diagnostics, setDiagnostics] = useState(null);
  const [selectedAuthor, setSelectedAuthor] = useState('');
  const [parseError, setParseError] = useState(null);
  const [fileName, setFileName] = useState('');
  const [slide, setSlide] = useState(0);
  const [parsingStage, setParsingStage] = useState(0);
  // Lang persists across visits: prefer the user's explicit choice from a
  // previous session, fall back to navigator.language on first visit.
  const [lang, setLangRaw] = useState(() => {
    try {
      const saved = localStorage.getItem('cw_lang');
      if (saved) return saved;
    } catch {}
    return detectLang();
  });
  const setLang = useCallback((l) => {
    setLangRaw(l);
    try { localStorage.setItem('cw_lang', l); } catch {}
  }, []);
  // Include media (photos / voice / stickers / videos) in the analysis.
  // Off = faster, text-only. Persisted so users don't re-toggle each visit.
  const [includeMedia, setIncludeMedia] = useState(() => {
    try { const v = localStorage.getItem('cw_include_media'); return v === null ? true : v === '1'; } catch { return true; }
  });
  const updateIncludeMedia = (v) => {
    setIncludeMedia(v);
    try { localStorage.setItem('cw_include_media', v ? '1' : '0'); } catch {}
  };
  const [showDemo, setShowDemo] = useState(() => {
    try { return localStorage.getItem('cw_show_demo') === '1'; } catch { return false; }
  });
  const updateShowDemo = useCallback((v) => {
    setShowDemo(v);
    try { localStorage.setItem('cw_show_demo', v ? '1' : '0'); } catch {}
  }, []);
  const [profile, setProfile] = useState({
    relationship: null,
    tone: null,
    self: null,
  });
  // Name + country captured by the Welcome questionnaire on first run.
  // userName is the auto-match key for Onboarding (lets us skip the
  // "Which one are you?" step when the chat has a matching participant).
  const [userName, setUserName] = useState(() => {
    try { return localStorage.getItem('cw_user_name') || ''; } catch { return ''; }
  });
  const [userCountry, setUserCountry] = useState(() => {
    try { return localStorage.getItem('cw_user_country') || ''; } catch { return ''; }
  });
  const [currentRecapId, setCurrentRecapId] = useState(null);
  const [history, setHistory] = useState(() => loadHistory());
  // ── Time-period scoping ──────────────────────────────────────────────
  // The selected chat's parsed messages + media are kept in memory so the
  // Landing card can preview any trailing window live, and so opening the
  // recap can recompute analytics for the chosen window without a re-parse.
  // `recapMessages`/`recapMedia` may be null (legacy recap with no persisted
  // messages → all-time only). `period` is one of 'all'|'year'|'season'|'month'.
  const [recapMessages, setRecapMessages] = useState(null);
  const [recapMedia, setRecapMedia] = useState(null);
  const [savedStats, setSavedStats] = useState(null);
  const [period, setPeriod] = useState('all');
  const [selectedRecapId, setSelectedRecapId] = useState(() => {
    try { return loadHistory()[0]?.id || null; } catch { return null; }
  });
  // Which recap's messages are currently in `recapMessages`, and whose live
  // media blob URLs are in `recapMedia`. Used to skip redundant IDB reloads.
  const [loadedSessionId, setLoadedSessionId] = useState(null);
  const [mediaSessionId, setMediaSessionId] = useState(null);
  // Where Settings should return to. Set just before entering the settings stage.
  const [settingsReturn, setSettingsReturn] = useState('landing');
  const openSettings = useCallback((from) => {
    setSettingsReturn(from);
    setStage('settings');
  }, []);

  // Where Roast Mode should return to — it's reachable from both the Wrapped
  // deck and the bottom-nav Modes hub. Set just before entering (or its ad gate).
  const [roastReturn, setRoastReturn] = useState('wrapped');
  const enterRoastMode = useCallback((from) => {
    setRoastReturn(from);
    setStage(adEnabled('pre_roast') ? 'ad_pre_roast' : 'roastmode');
  }, []);

  // Premium plan flag — Phase 1: client-side only, no real payment yet.
  // Sync the boolean to localStorage AND to ADS.userPremium so the module-level
  // adEnabled() returns false everywhere when premium is on.
  const [isPremium, setIsPremium] = useState(() => {
    try { return localStorage.getItem('cw_premium') === '1'; } catch { return false; }
  });
  useEffect(() => { ADS.userPremium = isPremium; }, [isPremium]);

  // Initialize AdMob once on mount, then preload the interstitials used by
  // the ad gates so they're ready by the time the stage machine reaches them.
  useEffect(() => {
    initAdMob().then(() => {
      loadInterstitial('post_parse');
      loadInterstitial('pre_wrapped');
      loadInterstitial('pre_roast');
    });
  }, []);
  const updatePremium = useCallback((v) => {
    setIsPremium(v);
    try { localStorage.setItem('cw_premium', v ? '1' : '0'); } catch {}
  }, []);

  // Entry-time premium promo — opens on every app mount for non-premium
  // users. Within a session, dismissing keeps it closed (no nag loop);
  // a refresh shows it again so we don't lose the reminder hook.
  const [promoOpen, setPromoOpen] = useState(() => shouldShowPromo(isPremium));
  const [paymentOpen, setPaymentOpen] = useState(false);
  const dismissPromo = useCallback(() => {
    markPromoDismissed();
    setPromoOpen(false);
  }, []);
  // "Upgrade" on the promo now opens the payment sheet instead of
  // immediately flipping the premium flag — the flag flips when payment
  // succeeds (stubbed) in onPaymentSuccess.
  const acceptPromo = useCallback(() => {
    setPromoOpen(false);
    setPaymentOpen(true);
  }, []);
  const onPaymentSuccess = useCallback(() => {
    updatePremium(true);
    setPaymentOpen(false);
  }, [updatePremium]);
  const t = useMemo(() => buildT(lang), [lang]);
  const isRTL = RTL_LANGS.has(lang);

  const handleFile = useCallback(async (file) => {
    setFileName(file.name);
    setParseError(null);
    setStage('parsing');
    setParsingStage(0);
    const lname = file.name.toLowerCase();
    if (!lname.endsWith('.zip') && !lname.endsWith('.txt')) {
      setParseError('Upload a .txt or .zip from WhatsApp export.');
      setStage('landing');
      return;
    }
    try {
      // ZIP inflate + parse run in a Web Worker so a huge export never
      // freezes the UI. Progress phases drive the cinematic stage meter.
      const { messages: parsed, diagnostics: diag, media } = await parseChat({
        file,
        includeMedia,
        onProgress: (phase) => setParsingStage(phase === 'unzip' ? 1 : 2),
      });
      setDiagnostics(diag);
      if (parsed.length === 0) {
        setParseError(t.err_no_msgs);
        setStage('landing');
        return;
      }
      setParsingStage(3);
      await new Promise(r => setTimeout(r, 400));
      const a = computeAll(parsed);
      // Real media (blob URLs) extracted on-device — empty when toggle is off
      // or when uploading a .txt. Each category is independent.
      // Demo file gets synthetic media injected so all media slides are populated.
      const isDemo = file.name === 'WhatsApp Chat with The Squad.txt';
      if (isDemo && includeMedia) {
        const dm = generateSampleMedia(a.users);
        a.photos = dm.photos; a.voice = dm.voice; a.videos = dm.videos; a.stickers = dm.stickers;
        a.totalPhotoCount = dm.photos.length;
        a.totalStickerInstances = dm.stickers.reduce((s, x) => s + (x.count || 1), 0);
      } else {
        a.photos   = media?.photos   || [];
        a.voice    = media?.voice    || [];
        a.videos   = media?.videos   || [];
        a.stickers = media?.stickers || [];
        a.totalPhotoCount       = media?.totalPhotoCount       ?? a.photos.length;
        a.totalStickerInstances = media?.totalStickerInstances ?? 0;
      }
      // Persist stats snapshot (without blob URLs — those die on reload).
      // Media blobs go to IndexedDB separately via mediaStore; raw messages go
      // to messageStore so the recap can be re-scoped to a window later.
      const { photos: _photos, voice: _voice, videos: _videos, stickers: _stickers, ...stats } = a;
      const entry = saveRecap({ chatName: deriveChatName({ diagnostics: diag, fileName: file.name }), stats });
      const sessionMedia = { photos: a.photos, voice: a.voice, videos: a.videos, stickers: a.stickers };
      setCurrentRecapId(entry.id);
      saveMedia(entry.id, sessionMedia);
      saveMessages(entry.id, parsed);
      setHistory(loadHistory());
      setParsingStage(4);
      await new Promise(r => setTimeout(r, 400));
      if (!a.users || a.users.length === 0) {
        // Parsed lines but classified zero senders — usually a system-only
        // export (joins/leaves) or an unsupported format the parser couldn't
        // attach to any header. Surface the diagnostic counters via
        // VerifyView rather than crashing on a.users[0].author.
        throw new Error(t.err_no_msgs);
      }
      // Parse-on-select: rather than jump straight into the deck, return to
      // Landing with this freshly-parsed chat selected and its messages/media
      // held in memory, so the card shows live per-window stats + the picker.
      // Tapping the CTA then opens the deck for whatever window is chosen.
      revokeMedia(recapMediaRef.current);
      setRecapMessages(parsed);
      setRecapMedia(sessionMedia);
      setSavedStats(stats);
      setSelectedRecapId(entry.id);
      setLoadedSessionId(entry.id);
      setMediaSessionId(entry.id);
      setPeriod('all');
      setAnalytics(null);
      setFullAnalytics(null);
      setSelectedAuthor('');
      setSlide(0);
      setStage('landing');
    } catch (e) {
      console.error(e);
      setParseError(e.message || t.err_format);
      setStage('landing');
    }
  }, [t]);

  // Web Share Target: when the OS share sheet opens the app, the SW redirects to
  // /?shared=1 and holds the File in memory. We request it via postMessage here.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onMessage = (event) => {
      if (event.data?.type === 'SHARED_FILE' && event.data.file) {
        handleFile(event.data.file);
      }
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    if (new URLSearchParams(window.location.search).has('shared')) {
      window.history.replaceState({}, '', window.location.pathname);
      navigator.serviceWorker.ready.then(reg => {
        reg.active?.postMessage({ type: 'GET_SHARED_FILE' });
      });
    }
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [handleFile]);


  // Capacitor Android: MainActivity copies the shared file into the app's cache
  // dir and hands us the *path* (not the bytes). We fetch it via Capacitor's
  // file-serving URL, which gives us a Blob backed by the WebView's blob storage —
  // the parser's Blob.slice() reads then pull byte ranges on demand instead of
  // holding the whole archive (potentially hundreds of MB) in JS heap.
  const handleFileRef = useRef(handleFile);
  useEffect(() => { handleFileRef.current = handleFile; }, [handleFile]);
  useEffect(() => {
    window.__capacitorSharedFile = (path, name, type) => {
      const url = window.Capacitor?.convertFileSrc?.(path) || ('file://' + path);
      fetch(url)
        .then(r => r.blob())
        .then(b => handleFileRef.current(new File([b], name, { type })))
        // Silent in production: a failed shared-file fetch isn't actionable
        // by the user. Set localStorage `cw_debug='1'` to surface it.
        .catch(err => { if (localStorage.getItem('cw_debug') === '1') console.error('Failed to load shared file', err); });
    };
    return () => { delete window.__capacitorSharedFile; };
  }, []);

  // Mirror the in-memory session into refs so the load/parse callbacks can read
  // the latest values without being re-created (and without stale closures).
  const recapMessagesRef = useRef(recapMessages);
  const recapMediaRef    = useRef(recapMedia);
  const loadedSessionRef = useRef(loadedSessionId);
  const mediaSessionRef  = useRef(mediaSessionId);
  const periodRef        = useRef(period);
  useEffect(() => { recapMessagesRef.current = recapMessages; }, [recapMessages]);
  useEffect(() => { recapMediaRef.current    = recapMedia;    }, [recapMedia]);
  useEffect(() => { loadedSessionRef.current = loadedSessionId; }, [loadedSessionId]);
  useEffect(() => { mediaSessionRef.current  = mediaSessionId; }, [mediaSessionId]);
  useEffect(() => { periodRef.current        = period;        }, [period]);

  const reset = () => {
    // Free every object URL created for chat media (full set) before dropping.
    revokeMedia(recapMediaRef.current);
    setAnalytics(null);
    setFullAnalytics(null);
    setDiagnostics(null);
    setCurrentRecapId(null);
    setRecapMessages(null);
    setRecapMedia(null);
    setSavedStats(null);
    setLoadedSessionId(null);
    setMediaSessionId(null);
    setSelectedRecapId(null);
    setPeriod('all');
    setStage('landing');
    setParseError(null);
    setSlide(0);
  };

  // Browsing history on Landing: lazily load the selected recap's messages so
  // the card can preview per-window stats. Media is deferred to open time.
  useEffect(() => {
    if (!selectedRecapId || selectedRecapId === loadedSessionId) return;
    let cancelled = false;
    (async () => {
      const entry = loadHistory().find(r => r.id === selectedRecapId);
      const loaded = await loadMessages(selectedRecapId);
      if (cancelled) return;
      setSavedStats(entry?.stats || null);
      setRecapMessages(loaded.length ? loaded : null);
      setLoadedSessionId(selectedRecapId);
    })();
    return () => { cancelled = true; };
  }, [selectedRecapId, loadedSessionId]);

  const handleSelectRecap = useCallback((id) => {
    setSelectedRecapId(id);
    setPeriod('all');
  }, []);

  const handleLoadRecap = useCallback(async (id, destination) => {
    const entry = loadHistory().find(r => r.id === id);
    if (!entry) return;
    const per = periodRef.current;

    // Messages: reuse the in-memory session if it's the same recap, else load.
    let msgs = recapMessagesRef.current;
    if (loadedSessionRef.current !== id || !msgs) {
      const loaded = await loadMessages(id);
      msgs = loaded.length ? loaded : null;
    }
    // Media: reuse in-memory if same session (keeps the live blob URLs); else
    // revoke the old set and load fresh from IndexedDB.
    let media = recapMediaRef.current;
    if (mediaSessionRef.current !== id || !media) {
      revokeMedia(recapMediaRef.current);
      media = await loadMedia(id);
    }

    // All-time analytics (game modes + onboarding). Legacy recaps with no
    // persisted messages fall back to the saved snapshot.
    const fullBase = msgs ? computeAll(msgs) : entry.stats;
    const fullA = fullBase ? attachMedia(fullBase, media, 'all', msgs) : null;
    // Period-filtered analytics (the deck). Identical to all-time when the
    // window is 'all' or there are no messages to slice.
    const filteredA = (per === 'all' || !msgs)
      ? fullA
      : attachMedia(computeAll(filterMessagesByPeriod(msgs, per)), media, per, msgs);

    const savedProfile = entry.profile || { relationship: null, tone: null, self: null };
    setRecapMessages(msgs);
    setRecapMedia(media);
    setSavedStats(entry.stats);
    setLoadedSessionId(id);
    setMediaSessionId(id);
    setFullAnalytics(fullA);
    setAnalytics(filteredA);
    setDiagnostics(null);
    setSelectedAuthor((filteredA || fullA)?.users?.[0]?.author || '');
    setProfile(savedProfile);
    setCurrentRecapId(id);
    setSelectedRecapId(id);
    setSlide(0);
    // First time landing on Wrapped: relationship hasn't been chosen yet,
    // show onboarding (it picks the slide deck via `profile.relationship`).
    // Onboarding only collects `self` + `relationship` (not `tone`), so
    // `relationship` is the signal that the user has been through it.
    // Game modes (Modes hub) don't read `profile` at all, so a `destination`
    // other than 'wrapped' skips onboarding entirely and goes straight in.
    const dest = destination || 'wrapped';
    if (!savedProfile.relationship && dest === 'wrapped') {
      setStage('onboard');
    } else {
      setStage(dest);
    }
  }, []);

  // Live card data for the selected recap, recomputed as the window changes.
  const previewStats = useMemo(() => {
    if (recapMessages && loadedSessionId === selectedRecapId) {
      return previewStatsForPeriod(recapMessages, period);
    }
    if (savedStats) {
      return {
        totalMessages: savedStats.totalMessages,
        totalParticipants: savedStats.totalParticipants ?? savedStats.users?.length ?? 0,
        durationDays: savedStats.durationDays,
      };
    }
    return null;
  }, [recapMessages, loadedSessionId, selectedRecapId, period, savedStats]);

  const periodChoices = useMemo(
    () => (recapMessages && loadedSessionId === selectedRecapId)
      ? availablePeriods(recapMessages)
      : ['all'],
    [recapMessages, loadedSessionId, selectedRecapId]
  );

  // Modes hub tiles need `analytics` to render — but a chat the user already
  // imported or picked from history may not be loaded into the active session
  // yet (Landing keeps the parsed result staged until the user confirms it).
  // Rather than show "locked" for a chat that's plainly already there, load
  // the most recent one on demand and continue straight into the requested mode.
  const enterMode = useCallback((destination) => {
    // Game modes run on all-time data (fullAnalytics), independent of the
    // window chosen for the deck.
    if (fullAnalytics) {
      if (destination === 'roastmode') enterRoastMode('modes');
      else setStage(destination);
      return;
    }
    const mostRecent = history[0];
    if (!mostRecent) return;
    if (destination === 'roastmode') {
      setRoastReturn('modes');
      const dest = adEnabled('pre_roast') ? 'ad_pre_roast' : 'roastmode';
      handleLoadRecap(mostRecent.id, dest);
    } else {
      handleLoadRecap(mostRecent.id, destination);
    }
  }, [fullAnalytics, history, enterRoastMode, handleLoadRecap]);

  const handleDeleteRecap = useCallback((id) => {
    deleteMedia(id);
    deleteMessages(id);
    const next = removeRecap(id);
    setHistory(next);
    setSelectedRecapId(prev => (prev === id ? (next[0]?.id || null) : prev));
  }, []);

  const handleClearHistory = useCallback(() => {
    clearAllMedia();
    clearAllMessages();
    clearHistory();
    setHistory([]);
    setSelectedRecapId(null);
  }, []);

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundImage: 'radial-gradient(ellipse at top, #1a1228 0%, #050505 70%)',
    }}>
      <GlobalStyles />
      {/* height is set by the .cw-frame class (100vh fallback → 100dvh)
          so we don't inline it here; an inline value would shadow the
          fallback chain and lose the mobile-URL-bar fix. */}
      <div className="cw-frame" style={{
        position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        width: '100vw',
        background: '#0a0a0f',
        color: '#f4f4f8',
        fontFamily: '"DM Sans", "Comix CLM", -apple-system, sans-serif',
        isolation: 'isolate',
      }}>
        <RotateLockOverlay t={t} />
        <BlobBackground />
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }} dir={isRTL ? 'rtl' : 'auto'}>
          {stage === 'welcome' && (
            <Welcome
              t={t}
              lang={lang}
              onComplete={({ lang: chosenLang, name }) => {
                if (chosenLang && I18N[chosenLang] && chosenLang !== lang) {
                  setLang(chosenLang);
                }
                // Persist name so Onboarding can match it against the
                // chat participants and auto-pick "who you are".
                if (name) {
                  setUserName(name);
                  try { localStorage.setItem('cw_user_name', name); } catch {}
                }
                try {
                  localStorage.setItem('cw_seen_welcome', '1');
                  localStorage.setItem('cw_seen_guide', '1');
                } catch {}
                setStage('landing');
              }}
            />
          )}
          {stage === 'howto' && (
            <HowToGuide
              t={t}
              lang={lang}
              setLang={setLang}
              onHome={() => {
                try { localStorage.setItem('cw_seen_guide', '1'); } catch {}
                setStage('landing');
              }}
              onStart={() => {
                try { localStorage.setItem('cw_seen_guide', '1'); } catch {}
                setStage('landing');
              }}
            />
          )}
          {stage === 'landing' && (
            <>
              <Landing
                onFile={handleFile}
                parseError={parseError}
                t={t}
                lang={lang}
                setLang={setLang}
                onHowTo={() => setStage('howto')}
                onDemo={showDemo ? true : null}
                onOpenSettings={() => openSettings('landing')}
                includeMedia={includeMedia}
                setIncludeMedia={updateIncludeMedia}
                history={history}
                onLoadRecap={handleLoadRecap}
                onDeleteRecap={handleDeleteRecap}
                onClearHistory={handleClearHistory}
                selectedRecapId={selectedRecapId}
                onSelectRecap={handleSelectRecap}
                period={period}
                setPeriod={setPeriod}
                periodChoices={periodChoices}
                previewStats={previewStats}
              />
              {/* shouldShowPromo() already returns false when isPremium is true,
                  so promoOpen alone is the sufficient condition. */}
              {promoOpen && (
                <PremiumPromo
                  t={t}
                  lang={lang}
                  onUpgrade={acceptPromo}
                  onDismiss={dismissPromo}
                />
              )}
            </>
          )}
          {stage === 'parsing' && (
            <Parsing fileName={fileName} parsingStage={parsingStage} diagnostics={diagnostics} t={t} />
          )}
          {stage === 'ad_post_parse' && (
            <VideoAdSlot
              slot="post_parse"
              t={t}
              onComplete={() => setStage('landing')}
            />
          )}
          {stage === 'onboard' && fullAnalytics && (
            <Onboarding
              analytics={fullAnalytics}
              t={t}
              profile={profile}
              setProfile={setProfile}
              userName={userName}
              onComplete={(finalProfile) => {
                setProfile(finalProfile);
                // Always save the profile if we have a current recap ID
                if (currentRecapId) {
                  updateRecapProfile(currentRecapId, finalProfile);
                }
                // Reload history after saving profile
                setHistory(loadHistory());
                if (finalProfile.self && fullAnalytics.userMap[finalProfile.self]) {
                  setSelectedAuthor(finalProfile.self);
                }
                setStage('wrapped');
              }}
              onSkip={() => {
                if (currentRecapId) {
                  updateRecapProfile(currentRecapId, profile);
                }
                setStage('wrapped');
              }}
            />
          )}
          {stage === 'ad_pre_wrapped' && (
            <VideoAdSlot
              slot="pre_wrapped"
              t={t}
              onComplete={() => setStage('wrapped')}
            />
          )}
          {stage === 'verify' && diagnostics && fullAnalytics && (
            <VerifyView
              diagnostics={diagnostics}
              analytics={fullAnalytics}
              fileName={fileName}
              t={t}
              onContinue={() => setStage('wrapped')}
              onReset={reset}
            />
          )}
          {stage === 'wrapped' && analytics && (
            <Wrapped
              slidesDef={SLIDES_BY_TYPE[profile.relationship] || SLIDES_BY_TYPE.other}
              slideComponents={SLIDE_COMPONENTS}
              analytics={analytics}
              diagnostics={diagnostics}
              selectedAuthor={selectedAuthor}
              setSelectedAuthor={setSelectedAuthor}
              slide={slide}
              setSlide={setSlide}
              profile={profile}
              setProfile={setProfile}
              period={period}
              t={t}
              lang={lang}
              onExit={() => {
                setCurrentRecapId(null);
                setStage('landing');
              }}
              onRoastMode={() => enterRoastMode('wrapped')}
            />
          )}
          {stage === 'settings' && (
            <Settings
              t={t}
              lang={lang}
              setLang={setLang}
              includeMedia={includeMedia}
              setIncludeMedia={updateIncludeMedia}
              showDemo={showDemo}
              setShowDemo={updateShowDemo}
              isPremium={isPremium}
              setPremium={updatePremium}
              onUpgrade={() => setPaymentOpen(true)}
              history={history}
              onClearHistory={handleClearHistory}
              onFile={handleFile}
              onBack={() => setStage(settingsReturn)}
            />
          )}
          {stage === 'ad_pre_roast' && (
            <VideoAdSlot
              slot="pre_roast"
              t={t}
              onComplete={() => setStage('roastmode')}
            />
          )}
          {stage === 'roastmode' && fullAnalytics && (
            <RoastMode
              analytics={fullAnalytics}
              selectedAuthor={selectedAuthor}
              setSelectedAuthor={setSelectedAuthor}
              t={t}
              onBack={() => setStage(roastReturn)}
            />
          )}
          {stage === 'modes' && (
            <Modes
              analytics={fullAnalytics}
              history={history}
              t={t}
              onUpload={() => setStage('landing')}
              onRoastMode={() => enterMode('roastmode')}
              onDuo={() => enterMode('duo')}
              onGuessWho={() => enterMode('guesswho')}
            />
          )}
          {stage === 'duo' && fullAnalytics && (
            <DuoQuest
              analytics={fullAnalytics}
              selectedAuthor={selectedAuthor}
              t={t}
              lang={lang}
              onBack={() => setStage('modes')}
            />
          )}
          {stage === 'guesswho' && (
            <GuessWho analytics={fullAnalytics} t={t} onBack={() => setStage('modes')} />
          )}
        </div>
        {(stage === 'landing' || stage === 'modes') && (
          <BottomNavBar
            active={stage === 'modes' ? 'modes' : 'home'}
            onHome={() => setStage('landing')}
            onModes={() => setStage('modes')}
            t={t}
          />
        )}
        {/* Payment sheet — rendered at App level so any surface (entry
            promo, Settings upsell, future inline CTAs) can open it via
            the shared `paymentOpen` flag. */}
        {paymentOpen && (
          <PaymentSheet
            t={t}
            lang={lang}
            onClose={() => setPaymentOpen(false)}
            onSuccess={onPaymentSuccess}
          />
        )}
      </div>
    </div>
  );
}
