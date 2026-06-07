import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { parseChat } from './parser/client.js';
import { computeAll } from './lib/analytics.js';
import { generateSampleText, generateSampleMedia } from './lib/sample.js';
import { loadHistory, saveRecap, removeRecap, clearHistory, deriveChatName, updateRecapProfile } from './lib/history.js';
import { saveMedia, loadMedia, deleteMedia, clearAllMedia } from './lib/mediaStore.js';
import { RTL_LANGS, detectLang, buildT } from './i18n';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import GlobalStyles from './components/GlobalStyles.jsx';
import BlobBackground from './components/BlobBackground.jsx';
import HomeIndicator from './components/HomeIndicator.jsx';
import HowToGuide from './views/HowToGuide.jsx';
import Landing from './views/Landing.jsx';
import Parsing from './views/Parsing.jsx';
import Onboarding from './views/Onboarding.jsx';
import Wrapped from './views/Wrapped.jsx';
import VerifyView from './views/VerifyView.jsx';
import RoastMode from './views/RoastMode.jsx';
import Settings from './views/Settings.jsx';
import VideoAdSlot from './components/VideoAdSlot.jsx';
import PremiumPromo, { shouldShowPromo, markPromoDismissed } from './components/PremiumPromo.jsx';
import { ADS, adEnabled } from './lib/ads.js';
import { SLIDES_BY_TYPE, SLIDE_COMPONENTS } from './slides';

// ============================================================
// MAIN
// ============================================================

export default function App() {
  return (
    <ErrorBoundary>
      <RecappedApp />
    </ErrorBoundary>
  );
}

function RecappedApp() {
  // First visit shows the how-to-export guide before the home screen; returning
  // visitors skip straight to home (the guide stays reachable from the home link).
  const [stage, setStage] = useState(() => {
    try { return localStorage.getItem('cw_seen_guide') ? 'landing' : 'howto'; } catch { return 'howto'; }
  });
  const [analytics, setAnalytics] = useState(null);
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
  const [currentRecapId, setCurrentRecapId] = useState(null);
  const [history, setHistory] = useState(() => loadHistory());
  // Where Settings should return to. Set just before entering the settings stage.
  const [settingsReturn, setSettingsReturn] = useState('landing');
  const openSettings = useCallback((from) => {
    setSettingsReturn(from);
    setStage('settings');
  }, []);

  // Premium plan flag — Phase 1: client-side only, no real payment yet.
  // Sync the boolean to localStorage AND to ADS.userPremium so the module-level
  // adEnabled() returns false everywhere when premium is on.
  const [isPremium, setIsPremium] = useState(() => {
    try { return localStorage.getItem('cw_premium') === '1'; } catch { return false; }
  });
  useEffect(() => { ADS.userPremium = isPremium; }, [isPremium]);
  const updatePremium = useCallback((v) => {
    setIsPremium(v);
    try { localStorage.setItem('cw_premium', v ? '1' : '0'); } catch {}
  }, []);

  // Entry-time premium promo — opens once on app mount for non-premium users
  // who haven't dismissed it in the last 24h. Closed for the rest of the
  // session even if user comes back to Landing (e.g., after Reset).
  const [promoOpen, setPromoOpen] = useState(() => shouldShowPromo(isPremium));
  const dismissPromo = useCallback(() => {
    markPromoDismissed();
    setPromoOpen(false);
  }, []);
  const acceptPromo = useCallback(() => {
    updatePremium(true);
    setPromoOpen(false);
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
      a.photos   = media?.photos   || [];
      a.voice    = media?.voice    || [];
      a.videos   = media?.videos   || [];
      a.stickers = media?.stickers || [];
      a.totalPhotoCount       = media?.totalPhotoCount       ?? a.photos.length;
      a.totalStickerInstances = media?.totalStickerInstances ?? 0;
      // Persist stats snapshot (without blob URLs — those die on reload).
      // Media blobs go to IndexedDB separately via mediaStore.
      const { photos: _photos, voice: _voice, videos: _videos, stickers: _stickers, ...stats } = a;
      const entry = saveRecap({ chatName: deriveChatName({ diagnostics: diag, fileName: file.name }), stats });
      setCurrentRecapId(entry.id);
      saveMedia(entry.id, { photos: a.photos, voice: a.voice, videos: a.videos, stickers: a.stickers });
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
      setAnalytics(null);
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

  const loadDemo = useCallback(async () => {
    setFileName('demo-chat.txt');
    setParseError(null);
    setStage('parsing');
    setParsingStage(0);
    await new Promise(r => setTimeout(r, 400));
    const text = generateSampleText();
    const { messages: parsed, diagnostics: diag } = await parseChat({
      text,
      onProgress: () => setParsingStage(2),
    });
    setDiagnostics(diag);
    await new Promise(r => setTimeout(r, 600));
    setParsingStage(3);
    const a = computeAll(parsed);
    // Synthetic media so the demo previews the photos/voice/stickers slides
    // (videos skipped — minimal playable MP4 is hard to generate). Respects
    // the same toggle as a real upload: off → demo stays text-only too.
    if (includeMedia) {
      const dm = generateSampleMedia(a.users);
      a.photos = dm.photos; a.voice = dm.voice; a.videos = dm.videos; a.stickers = dm.stickers;
      a.totalPhotoCount = dm.photos.length;
      a.totalStickerInstances = dm.stickers.reduce((s, x) => s + (x.count || 1), 0);
    } else {
      a.photos = []; a.voice = []; a.videos = []; a.stickers = [];
      a.totalPhotoCount = 0; a.totalStickerInstances = 0;
    }
    await new Promise(r => setTimeout(r, 500));
    setParsingStage(4);
    await new Promise(r => setTimeout(r, 400));
    if (!a.users || a.users.length === 0) {
      // The bundled sample text always has multiple users, so reaching
      // here means generateSampleText() got corrupted somehow — fail loud
      // rather than crashing on undefined.author.
      console.error('Demo produced no users — sample text is broken');
      setParseError(t.err_no_msgs);
      setStage('landing');
      return;
    }
    setAnalytics(a);
    setSelectedAuthor(a.users[0].author);
    setSlide(0);
    setStage(adEnabled('post_parse') ? 'ad_post_parse' : 'onboard');
  }, [includeMedia, t]);

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

  const reset = () => {
    // Free any object URLs created for chat media before dropping analytics.
    if (analytics) {
      const all = [
        ...(analytics.photos   || []),
        ...(analytics.voice    || []),
        ...(analytics.videos   || []),
        ...(analytics.stickers || []),
      ];
      for (const m of all) { try { URL.revokeObjectURL(m.url); } catch {} }
    }
    setAnalytics(null);
    setDiagnostics(null);
    setCurrentRecapId(null);
    setStage('landing');
    setParseError(null);
    setSlide(0);
  };

  const analyticsRef = useRef(analytics);
  useEffect(() => { analyticsRef.current = analytics; }, [analytics]);

  const handleLoadRecap = useCallback(async (id) => {
    // Always reload fresh from storage to get the latest profile
    const freshHistory = loadHistory();
    const entry = freshHistory.find(r => r.id === id);
    if (!entry) return;
    // Revoke blob URLs from whatever recap is currently active before swapping.
    const prev = analyticsRef.current;
    if (prev) {
      for (const m of [...(prev.photos||[]), ...(prev.voice||[]), ...(prev.videos||[]), ...(prev.stickers||[])]) {
        try { URL.revokeObjectURL(m.url); } catch {}
      }
    }
    const media = await loadMedia(id);
    const a = { ...entry.stats, ...media };
    const savedProfile = entry.profile || { relationship: null, tone: null, self: null };
    setDiagnostics(null);
    setAnalytics(a);
    setSelectedAuthor(a.users?.[0]?.author || '');
    setProfile(savedProfile);
    setCurrentRecapId(id);
    setSlide(0);
    // First time: relationship hasn't been chosen yet, show onboarding.
    // Onboarding only collects `self` + `relationship` (not `tone`), so
    // `relationship` is the signal that the user has been through it.
    if (!savedProfile.relationship) {
      setStage('onboard');
    } else {
      setStage('wrapped');
    }
  }, []);

  const handleDeleteRecap = useCallback((id) => {
    deleteMedia(id);
    setHistory(removeRecap(id));
  }, []);

  const handleClearHistory = useCallback(() => {
    clearAllMedia();
    clearHistory();
    setHistory([]);
  }, []);

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundImage: 'radial-gradient(ellipse at top, #1a1228 0%, #050505 70%)',
    }}>
      <GlobalStyles />
      <div className="cw-frame" style={{
        position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        width: '100vw',
        height: '100vh',
        background: '#0a0a0f',
        color: '#f4f4f8',
        fontFamily: '"DM Sans", "Comix CLM", -apple-system, sans-serif',
        isolation: 'isolate',
      }}>
        <BlobBackground />
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }} dir={isRTL ? 'rtl' : 'auto'}>
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
                onDemo={showDemo ? loadDemo : null}
                onOpenSettings={() => openSettings('landing')}
                includeMedia={includeMedia}
                setIncludeMedia={updateIncludeMedia}
                history={history}
                onLoadRecap={handleLoadRecap}
                onDeleteRecap={handleDeleteRecap}
                onClearHistory={handleClearHistory}
              />
              {/* shouldShowPromo() already returns false when isPremium is true,
                  so promoOpen alone is the sufficient condition. */}
              {promoOpen && (
                <PremiumPromo
                  t={t}
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
          {stage === 'onboard' && analytics && (
            <Onboarding
              analytics={analytics}
              t={t}
              profile={profile}
              setProfile={setProfile}
              onComplete={(finalProfile) => {
                setProfile(finalProfile);
                // Always save the profile if we have a current recap ID
                if (currentRecapId) {
                  updateRecapProfile(currentRecapId, finalProfile);
                }
                // Reload history after saving profile
                setHistory(loadHistory());
                if (finalProfile.self && analytics.userMap[finalProfile.self]) {
                  setSelectedAuthor(finalProfile.self);
                }
                setStage(adEnabled('pre_wrapped') ? 'ad_pre_wrapped' : 'wrapped');
              }}
              onSkip={() => {
                if (currentRecapId) {
                  updateRecapProfile(currentRecapId, profile);
                }
                setStage(adEnabled('pre_wrapped') ? 'ad_pre_wrapped' : 'wrapped');
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
          {stage === 'verify' && diagnostics && analytics && (
            <VerifyView
              diagnostics={diagnostics}
              analytics={analytics}
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
              t={t}
              lang={lang}
              onExit={() => {
                setCurrentRecapId(null);
                setStage('landing');
              }}
              onRoastMode={() => setStage(adEnabled('pre_roast') ? 'ad_pre_roast' : 'roastmode')}
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
              history={history}
              onClearHistory={handleClearHistory}
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
          {stage === 'roastmode' && analytics && (
            <RoastMode
              analytics={analytics}
              selectedAuthor={selectedAuthor}
              setSelectedAuthor={setSelectedAuthor}
              t={t}
              onBack={() => setStage('wrapped')}
            />
          )}
        </div>
        <HomeIndicator />
      </div>
    </div>
  );
}
