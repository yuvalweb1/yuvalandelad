import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { parseChat } from './parser/client.js';
import { computeAll } from './lib/analytics.js';
import { generateSampleText, generateSampleMedia } from './lib/sample.js';
import { loadHistory, saveRecap, removeRecap, clearHistory, deriveChatName } from './lib/history.js';
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
import PostMenu from './views/PostMenu.jsx';
import VerifyView from './views/VerifyView.jsx';
import RoastMode from './views/RoastMode.jsx';
import Settings from './views/Settings.jsx';
import VideoAdSlot from './components/VideoAdSlot.jsx';
import { adEnabled } from './lib/ads.js';
import { SLIDES_BY_TYPE, SLIDE_COMPONENTS } from './slides';

// ============================================================
// MAIN
// ============================================================

export default function App() {
  return (
    <ErrorBoundary>
      <ChatWrappedApp />
    </ErrorBoundary>
  );
}

function ChatWrappedApp() {
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
  const [lang, setLang] = useState(() => detectLang());
  // Include media (photos / voice / stickers / videos) in the analysis.
  // Off = faster, text-only. Persisted so users don't re-toggle each visit.
  const [includeMedia, setIncludeMedia] = useState(() => {
    try { const v = localStorage.getItem('cw_include_media'); return v === null ? true : v === '1'; } catch { return true; }
  });
  const updateIncludeMedia = (v) => {
    setIncludeMedia(v);
    try { localStorage.setItem('cw_include_media', v ? '1' : '0'); } catch {}
  };
  const [profile, setProfile] = useState({
    relationship: null,
    tone: null,
    self: null,
  });
  const [history, setHistory] = useState(() => loadHistory());
  // Where Settings should return to. Set just before entering the settings stage.
  const [settingsReturn, setSettingsReturn] = useState('landing');
  const openSettings = useCallback((from) => {
    setSettingsReturn(from);
    setStage('settings');
  }, []);
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
      // Persist a snapshot (without blob URLs — those die on reload).
      const { photos: _photos, voice: _voice, videos: _videos, stickers: _stickers, ...stats } = a;
      saveRecap({ chatName: deriveChatName({ diagnostics: diag, fileName: file.name }), stats });
      setHistory(loadHistory());
      setParsingStage(4);
      await new Promise(r => setTimeout(r, 400));
      setAnalytics(a);
      setSelectedAuthor(a.users[0].author);
      setSlide(0);
      setStage(adEnabled('post_parse') ? 'ad_post_parse' : 'onboard');
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
    } else {
      a.photos = []; a.voice = []; a.videos = []; a.stickers = [];
    }
    await new Promise(r => setTimeout(r, 500));
    setParsingStage(4);
    await new Promise(r => setTimeout(r, 400));
    setAnalytics(a);
    setSelectedAuthor(a.users[0].author);
    setSlide(0);
    setStage(adEnabled('post_parse') ? 'ad_post_parse' : 'onboard');
  }, [includeMedia]);

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
        .catch(err => console.error('Failed to load shared file', err));
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
    setStage('landing');
    setParseError(null);
    setSlide(0);
  };

  const handleLoadRecap = useCallback((id) => {
    const entry = loadHistory().find(r => r.id === id);
    if (!entry) return;
    // Reconstruct analytics shape: stored stats + empty photos
    // (blob URLs from the original session are long gone).
    const a = { ...entry.stats, photos: [] };
    setDiagnostics(null);
    setAnalytics(a);
    setSelectedAuthor(a.users?.[0]?.author || '');
    setProfile({ relationship: null, tone: null, self: null });
    setSlide(0);
    setStage('wrapped');
  }, []);

  const handleDeleteRecap = useCallback((id) => {
    setHistory(removeRecap(id));
  }, []);

  const handleClearHistory = useCallback(() => {
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
        <div aria-hidden="true" style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 28,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.55) 30%, rgba(0,0,0,0.18) 65%, transparent 100%)',
          zIndex: 1, pointerEvents: 'none',
        }} />
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }} dir={isRTL ? 'rtl' : 'auto'}>
          {stage === 'howto' && (
            <HowToGuide
              t={t}
              onStart={() => {
                try { localStorage.setItem('cw_seen_guide', '1'); } catch {}
                setStage('landing');
              }}
            />
          )}
          {stage === 'landing' && (
            <Landing
              onFile={handleFile}
              parseError={parseError}
              t={t}
              lang={lang}
              setLang={setLang}
              onHowTo={() => setStage('howto')}
              onDemo={loadDemo}
              onOpenSettings={() => openSettings('landing')}
              includeMedia={includeMedia}
              setIncludeMedia={updateIncludeMedia}
              history={history}
              onLoadRecap={handleLoadRecap}
              onDeleteRecap={handleDeleteRecap}
              onClearHistory={handleClearHistory}
            />
          )}
          {stage === 'parsing' && (
            <Parsing fileName={fileName} parsingStage={parsingStage} diagnostics={diagnostics} t={t} />
          )}
          {stage === 'ad_post_parse' && (
            <VideoAdSlot
              slot="post_parse"
              t={t}
              onComplete={() => setStage('onboard')}
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
                if (finalProfile.self && analytics.userMap[finalProfile.self]) {
                  setSelectedAuthor(finalProfile.self);
                }
                setStage(adEnabled('pre_wrapped') ? 'ad_pre_wrapped' : 'wrapped');
              }}
              onSkip={() => setStage(adEnabled('pre_wrapped') ? 'ad_pre_wrapped' : 'wrapped')}
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
              onExit={() => setStage('landing')}
              onMenu={() => setStage(adEnabled('pre_menu') ? 'ad_pre_menu' : 'menu')}
              onRoastMode={() => setStage(adEnabled('pre_roast') ? 'ad_pre_roast' : 'roastmode')}
            />
          )}
          {stage === 'ad_pre_menu' && (
            <VideoAdSlot
              slot="pre_menu"
              t={t}
              onComplete={() => setStage('menu')}
            />
          )}
          {stage === 'menu' && analytics && (
            <PostMenu
              analytics={analytics}
              diagnostics={diagnostics}
              selectedAuthor={selectedAuthor}
              setSelectedAuthor={setSelectedAuthor}
              t={t}
              onReplay={() => { setSlide(0); setStage('wrapped'); }}
              onReset={reset}
              onDebug={() => setStage('verify')}
              onOpenSettings={() => openSettings('menu')}
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
              onBack={() => setStage('menu')}
            />
          )}
        </div>
        <HomeIndicator />
      </div>
    </div>
  );
}
