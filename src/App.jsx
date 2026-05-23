import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { parseChat } from './parser/client.js';
import { computeAll } from './lib/analytics.js';
import { generateSampleText } from './lib/sample.js';
import { RTL_LANGS, detectLang, buildT, interp, resolveTitle, resolveTitleEvidence } from './i18n';
import { useAnimatedNumber } from './hooks/useAnimatedNumber.js';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import GlobalStyles from './components/GlobalStyles.jsx';
import BlobBackground from './components/BlobBackground.jsx';
import SlidesBlobBackground from './components/SlidesBlobBackground.jsx';
import StatusBar from './components/StatusBar.jsx';
import HomeIndicator from './components/HomeIndicator.jsx';
import BottomSheet from './components/BottomSheet.jsx';
import HowToGuide from './views/HowToGuide.jsx';
import Landing from './views/Landing.jsx';
import Parsing from './views/Parsing.jsx';
import Onboarding from './views/Onboarding.jsx';
import Wrapped from './views/Wrapped.jsx';
import PostMenu from './views/PostMenu.jsx';
import VerifyView from './views/VerifyView.jsx';
import RoastMode from './views/RoastMode.jsx';

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
  const [profile, setProfile] = useState({
    relationship: null,
    tone: null,
    self: null,
  });
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
      a.photos = media || [];   // real images from a "with media" .zip (blob URLs)
      setParsingStage(4);
      await new Promise(r => setTimeout(r, 400));
      setAnalytics(a);
      setSelectedAuthor(a.users[0].author);
      setSlide(0);
      setStage('onboard');
    } catch (e) {
      console.error(e);
      setParseError(e.message || t.err_format);
      setStage('landing');
    }
  }, [t]);

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
    await new Promise(r => setTimeout(r, 500));
    setParsingStage(4);
    await new Promise(r => setTimeout(r, 400));
    setAnalytics(a);
    setSelectedAuthor(a.users[0].author);
    setSlide(0);
    setStage('onboard');
  }, []);

  const reset = () => {
    // Free any object URLs created for chat photos before dropping analytics.
    if (analytics && analytics.photos) {
      for (const p of analytics.photos) { try { URL.revokeObjectURL(p.url); } catch {} }
    }
    setAnalytics(null);
    setDiagnostics(null);
    setStage('landing');
    setParseError(null);
    setSlide(0);
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 12,
      backgroundImage: 'radial-gradient(ellipse at top, #1a1228 0%, #050505 70%)',
    }}>
      <GlobalStyles />
      <div className="cw-frame" style={{
        position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        width: '100%', maxWidth: 380,
        height: 'min(820px, calc(100vh - 24px))',
        background: '#0a0a0f',
        borderRadius: 40,
        border: '1px solid #1a1a24',
        boxShadow: '0 30px 80px rgba(0,0,0,0.5), 0 0 0 6px #0a0a10',
        color: '#f4f4f8',
        fontFamily: '"DM Sans", "Comix CLM", -apple-system, sans-serif',
        isolation: 'isolate',
      }}>
        <BlobBackground />
        <StatusBar />
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
              onDemo={loadDemo}
              parseError={parseError}
              t={t}
              lang={lang}
              setLang={setLang}
              onHowTo={() => setStage('howto')}
            />
          )}
          {stage === 'parsing' && (
            <Parsing fileName={fileName} parsingStage={parsingStage} diagnostics={diagnostics} t={t} />
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
                setStage('wrapped');
              }}
              onSkip={() => setStage('wrapped')}
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
              slidesDef={SLIDES_DEF}
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
              onMenu={() => setStage('menu')}
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
              onRoastMode={() => setStage('roastmode')}
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

// ============================================================
// WRAPPED — story player
// ============================================================

// Tight, group-first deck (~8 slides). Verified group data first, ending on
// teaser/unlock cards so the user finishes wanting more. The older per-user
// slides (night, speed, streak, vibe_check, eras, …) stay registered in
// SLIDE_COMPONENTS and remain reachable from the post-Wrapped menu / "full
// stats" — they're just no longer part of the main auto-play story.
const SLIDES_DEF = [
  'group_overview',   // total messages, participants, date range, peak hour + busiest day
  'leaderboard',      // full ranking by messages, quietest flagged
  'per_person',       // messages, % of total, words, avg words/msg
  'signature_words',  // one meaningful word per person
  'group_top',        // group's top emoji + top meaningful word
  'photos',           // real photos from a "with media" export (skipped if none)
  'awards',           // superlatives from real stats
  'drama_role',       // your role in the group
  'teaser',           // locked cards: roast / duo / profile / chaos → want more
];

// ============================================================
// SLIDE SHELL
// ============================================================

const SlideShell = React.memo(function SlideShell({ children, bg, accent = '#f9c74f', shake = false }) {
  return (
    <div className={shake ? 'a-shake' : ''} style={{
      position: 'absolute', inset: 0, overflow: 'hidden', background: 'transparent',
    }}>
      <div style={{
        position: 'absolute', top: -80, right: -80, width: 300, height: 300,
        borderRadius: '50%', background: accent, opacity: 0.22,
        filter: 'blur(90px)', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: -100, left: -80, width: 260, height: 260,
        borderRadius: '50%', background: accent, opacity: 0.12,
        filter: 'blur(90px)', pointerEvents: 'none',
      }} />
      <div className="slide-content" style={{ height: '100%' }}>
        {children}
      </div>
    </div>
  );
})

// ============================================================
// SLIDES — ALL data flows from props (no random/inferred fields)
// ============================================================

const SlideIntro = React.memo(function SlideIntro({ a, t }) {
  const year = new Date().getFullYear();
  return (
    <SlideShell bg="#577590" accent="#f9c74f">
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
        textAlign: 'center', padding: '0 24px',
      }}>
        <div className="fs-sans a-fade-up" style={{ fontSize: 12, color: '#f9c74f', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase' }}>
          {t.intro_eyebrow} · {year}
        </div>
        <div className="a-spring" style={{ animationDelay: '0.3s', marginTop: 48 }}>
          <div className="fs-display" style={{ fontSize: 56, lineHeight: 1.1, letterSpacing: '-0.04em', fontWeight: 800, color: '#2a0645' }}>
            {t.intro_get && <span style={{ display: 'block' }}>{t.intro_get}</span>}
            {t.intro_ready && <span style={{ display: 'block', fontStyle: 'italic', color: '#f9c74f' }}>{t.intro_ready}</span>}
          </div>
        </div>
        <div className="fs-sans a-fade-up" style={{
          animationDelay: '0.8s', marginTop: 32, fontSize: 18, color: 'rgba(42,6,69,0.85)', maxWidth: 280, lineHeight: 1.45,
        }}>
          {interp(t.intro_summary, {
            msgs: a.totalMessages.toLocaleString(),
            people: a.totalParticipants,
            days: a.durationDays,
          })}
        </div>
      </div>
    </SlideShell>
  );
})

const SlideMessageCount = React.memo(function SlideMessageCount({ a, u, t }) {
  const animatedGroup = useAnimatedNumber(a.totalMessages, 1800, [a.totalMessages]);
  const animatedUser = useAnimatedNumber(u.messageCount, 1600, [u.author]);
  return (
    <SlideShell bg="#f3722c" accent="#f94144">
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        textAlign: 'center', padding: '0 24px',
      }}>
        <div className="fs-sans a-fade-up" style={{ fontSize: 12, color: '#f94144', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase' }}>
          {t.msg_eyebrow}
        </div>
        <div className="fs-display a-spring a-pulse-glow" style={{
          animationDelay: '0.2s',
          fontSize: a.totalMessages > 99999 ? 56 : a.totalMessages > 9999 ? 60 : 64,
          lineHeight: 1.1, letterSpacing: '-0.04em', color: '#f94144',
          marginTop: 48, fontWeight: 800,
        }}>
          {animatedGroup.toLocaleString()}
        </div>
        <div className="fs-display a-fade-up" style={{
          animationDelay: '0.6s', fontSize: 20, marginTop: 8, fontStyle: 'italic', fontWeight: 700, color: '#2a0645',
        }}>
          {t.msg_word}
        </div>

        <div className="a-fade-up" style={{
          animationDelay: '1.5s', marginTop: 48,
        }}>
          <div className="fs-sans" style={{
            fontSize: 12, color: 'rgba(42,6,69,0.78)', letterSpacing: '0.15em', marginBottom: 12, fontWeight: 500, textTransform: 'uppercase',
          }}>
            {t.msg_your_share}
          </div>
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 10,
          }}>
            <div className="fs-display" style={{
              fontSize: 48, color: '#2a0645', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1,
            }}>
              {animatedUser.toLocaleString()}
            </div>
            <div className="fs-mono" style={{ fontSize: 18, color: 'rgba(42,6,69,0.82)' }}>
              · {u.sharePct.toFixed(1)}%
            </div>
          </div>

          <div style={{
            marginTop: 14, marginInline: 'auto', maxWidth: 240,
            height: 10, borderRadius: 999,
            background: 'rgba(255,255,255,0.40)', overflow: 'hidden',
            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.15)',
          }}>
            <div style={{
              height: '100%', minWidth: 16, width: `${u.sharePct}%`,
              background: '#f9c74f', borderRadius: 999,
              transformOrigin: 'left',
              animation: 'barGrow 1.2s cubic-bezier(0.16, 1, 0.3, 1) 1.8s both',
              boxShadow: '0 0 8px rgba(249,199,79,0.6)',
            }} />
          </div>
        </div>
      </div>
    </SlideShell>
  );
})

const SlideRank = React.memo(function SlideRank({ a, u, t }) {
  const rank = a.users.findIndex(x => x.author === u.author) + 1;
  const ordinal = (n) => {
    const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };
  const top5 = a.users.slice(0, 5);
  const maxMsgs = top5[0].messageCount;

  return (
    <SlideShell bg="#577590" accent="#f9c74f">
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '0 24px',
      }}>
        <div className="fs-sans a-fade-up" style={{ fontSize: 12, color: '#f9c74f', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase' }}>
          {t.rank_eyebrow}
        </div>
        <div className="fs-display a-fade-up" style={{
          animationDelay: '0.2s', fontSize: 28, lineHeight: 1.15, letterSpacing: '-0.03em', marginTop: 16, fontWeight: 700, color: '#2a0645',
        }}>
          {t.rank_finished}<br/>
          <span style={{ color: '#f9c74f', fontStyle: 'italic' }}>{ordinal(rank)}</span> {interp(t.rank_of, { n: a.users.length })}
        </div>
        <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {top5.map((row, i) => {
            const isUser = row.author === u.author;
            const isFirst = i === 0;
            return (
              <div key={row.author} dir="auto" className="a-slide-right" style={{
                position: 'relative',
                padding: '14px 20px',
                background: isFirst ? 'rgba(249,199,79,0.22)' : isUser ? 'rgba(42,6,69,0.08)' : 'rgba(42,6,69,0.05)',
                borderRadius: 18, overflow: 'hidden',
                animationDelay: `${0.45 + i * 0.1}s`,
              }}>
                <div className="a-bar" style={{
                  position: 'absolute', top: 0, bottom: 0, insetInlineStart: 0,
                  width: `${(row.messageCount / maxMsgs) * 100}%`,
                  background: isFirst ? 'rgba(249,199,79,0.12)' : 'rgba(42,6,69,0.04)',
                  animationDelay: `${0.65 + i * 0.1}s`,
                }} />
                <div style={{
                  position: 'relative', display: 'flex',
                  alignItems: 'center', gap: 14,
                }}>
                  <div className="fs-display" style={{
                    fontSize: 28, fontWeight: 800, lineHeight: 1,
                    color: isFirst ? '#f9c74f' : 'rgba(42,6,69,0.25)',
                    width: 36, flexShrink: 0,
                  }}>
                    {i + 1}
                  </div>
                  <div style={{
                    flex: 1, minWidth: 0,
                    fontSize: 16, fontWeight: isUser || isFirst ? 700 : 500,
                    color: isFirst ? '#f9c74f' : '#fff1f5',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {row.author} {isUser && <span style={{ color: '#f9c74f', fontSize: 13, fontWeight: 600 }}>{t.rank_you}</span>}
                  </div>
                  <div className="fs-mono" style={{
                    fontSize: 15, fontWeight: 600,
                    color: isFirst ? '#f9c74f' : 'rgba(42,6,69,0.78)',
                    flexShrink: 0,
                  }}>
                    {row.messageCount.toLocaleString()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SlideShell>
  );
})

const SlideVsEveryone = React.memo(function SlideVsEveryone({ a, u, t }) {
  const rank = a.users.findIndex(x => x.author === u.author) + 1;
  const totalUsers = a.users.length;
  const others = totalUsers - 1;
  const beatCount = a.users.filter(x => x.author !== u.author && x.messageCount < u.messageCount).length;
  const animatedBeat = useAnimatedNumber(beatCount, 1400, [u.author]);
  const animatedTotal = useAnimatedNumber(others, 1400, [u.author]);

  const isFirst = rank === 1;
  const isLast = rank === totalUsers;

  const fastestAvg = a.fastestResponder?.avgRespMin;
  const fastestAvgText = fastestAvg == null ? '' :
    fastestAvg < 1 ? interp(t.vs_avg_s, { s: Math.round(fastestAvg * 60) })
    : fastestAvg < 60 ? interp(t.vs_avg_m, { m: fastestAvg.toFixed(1) })
    : interp(t.vs_avg_h, { h: (fastestAvg / 60).toFixed(1) });

  return (
    <SlideShell bg="#577590" accent="#277da1">
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        textAlign: 'center', padding: '0 24px',
      }}>
        <div className="fs-sans a-fade-up" style={{ fontSize: 12, color: '#277da1', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase' }}>
          {t.vs_eyebrow}
        </div>

        <div className="a-spring a-pulse-glow" style={{ animationDelay: '0.2s', marginTop: 48 }}>
          <div className="fs-display" style={{
            fontSize: 64, lineHeight: 1.1, letterSpacing: '-0.04em',
            color: '#277da1', fontWeight: 800,
          }}>
            {animatedBeat}<span style={{ fontSize: 36, color: 'rgba(42,6,69,0.62)' }}>/{animatedTotal}</span>
          </div>
        </div>

        <div className="a-fade-up" style={{ animationDelay: '0.7s', marginTop: 20 }}>
          <div className="fs-display" style={{
            fontSize: 20, lineHeight: 1.35, fontStyle: 'italic', fontWeight: 700, letterSpacing: '-0.02em',
            whiteSpace: 'pre-line',
          }}>
            {isFirst && others > 0 && t.vs_outsent_all}
            {isLast && others > 0 && t.vs_least}
            {!isFirst && !isLast && interp(t.vs_middle, { beat: beatCount, others })}
            {others === 0 && t.vs_alone}
          </div>
        </div>

        <div className="fs-mono a-fade-up" style={{
          animationDelay: '1.0s', marginTop: 20, fontSize: 16, color: 'rgba(42,6,69,0.82)', letterSpacing: '0.08em',
        }}>
          {interp(t.vs_ranked, { msgs: u.messageCount.toLocaleString(), rank, total: totalUsers })}
        </div>

        {a.fastestResponder && a.fastestResponder.author !== u.author && a.fastestResponder.avgRespMin != null && (
          <div className="a-fade-up" style={{ animationDelay: '1.3s', marginTop: 24 }}>
            <div className="fs-sans" style={{ fontSize: 12, color: 'rgba(42,6,69,0.75)', letterSpacing: '0.12em', fontWeight: 500, textTransform: 'uppercase' }}>
              {t.vs_fastest}
            </div>
            <div className="fs-display" style={{
              fontSize: 20, color: '#277da1', fontStyle: 'italic', fontWeight: 700,
              marginTop: 6, letterSpacing: '-0.02em',
            }}>
              {a.fastestResponder.author}
            </div>
            <div className="fs-mono" style={{ fontSize: 16, color: 'rgba(42,6,69,0.75)', marginTop: 2 }}>
              {fastestAvgText}
            </div>
          </div>
        )}
      </div>
    </SlideShell>
  );
})

const SlideTitle = React.memo(function SlideTitle({ u, t }) {
  const title = resolveTitle(u, t);
  const evidence = resolveTitleEvidence(u, t);
  return (
    <SlideShell bg="#577590" accent="#f9c74f">
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
        textAlign: 'center', padding: '0 24px',
      }}>
        <div className="fs-sans a-fade-up" style={{ fontSize: 12, color: '#f9c74f', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase' }}>
          {t.title_eyebrow}
        </div>
        <div className="a-spring a-pulse-glow" style={{ animationDelay: '0.3s', marginTop: 48 }}>
          <div className="fs-display" style={{
            fontSize: title.length > 22 ? 32 : title.length > 16 ? 40 : 52,
            lineHeight: 1.1, letterSpacing: '-0.03em',
            color: '#f9c74f', fontStyle: 'italic', fontWeight: 800,
          }}>
            {title}
          </div>
        </div>
        <div className="a-fade-up" style={{ animationDelay: '1.0s', marginTop: 40 }}>
          <div className="fs-sans" style={{ fontSize: 12, color: 'rgba(42,6,69,0.75)', letterSpacing: '0.12em', fontWeight: 500, textTransform: 'uppercase' }}>
            {t.title_based_on}
          </div>
          <div className="fs-sans" style={{ fontSize: 18, color: '#2a0645', marginTop: 8, fontWeight: 500, lineHeight: 1.4 }}>
            {evidence}
          </div>
        </div>
      </div>
    </SlideShell>
  );
})

const SlideGroupDescribes = React.memo(function SlideGroupDescribes({ u, t }) {
  return (
    <SlideShell bg="#f9c74f" accent="#577590">
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '0 24px',
      }}>
        <div className="fs-sans a-fade-up" style={{ fontSize: 12, color: '#577590', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase' }}>
          {t.descr_eyebrow}
        </div>
        <div className="a-spring" style={{ animationDelay: '0.3s', marginTop: 48 }}>
          <div className="fs-display" style={{
            fontSize: 36, lineHeight: 1.2, letterSpacing: '-0.03em', fontStyle: 'italic', fontWeight: 700, color: '#1a1a2e',
          }}>
            "{t[u.groupDescriptionKey] || u.groupDescriptionKey}"
          </div>
        </div>
        <div className="fs-sans a-fade-up" style={{
          animationDelay: '1.0s', marginTop: 40, fontSize: 18, lineHeight: 1.5, color: 'rgba(87,117,144,0.88)',
        }}>
          {t.descr_footnote}
        </div>
      </div>
    </SlideShell>
  );
})

const SlidePeakHour = React.memo(function SlidePeakHour({ a, u, t }) {
  const hour = u.peakHour;
  const hourStr = String(hour).padStart(2, '0');
  const max = Math.max(...a.groupHourly);
  return (
    <SlideShell bg="#577590" accent="#277da1">
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        textAlign: 'center', padding: '0 24px',
      }}>
        <div className="fs-sans a-fade-up" style={{ fontSize: 12, color: '#277da1', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase' }}>
          {t.peak_eyebrow}
        </div>
        <div className="fs-display a-spring" style={{
          animationDelay: '0.2s', fontSize: 64, lineHeight: 1.1,
          letterSpacing: '-0.04em', marginTop: 48, fontWeight: 800, color: '#2a0645',
        }}>
          {hourStr}<span style={{ color: '#277da1' }}>:00</span>
        </div>
        <div className="a-fade-up" style={{
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          gap: 2, marginTop: 32, height: 56,
          animationDelay: '0.7s',
        }}>
          {a.groupHourly.map((c, h) => (
            <div key={h} className="a-bar" style={{
              width: 7, height: `${(c / max) * 56}px`,
              background: h === hour ? '#277da1' : 'rgba(42,6,69,0.12)',
              borderRadius: 1,
              animationDelay: `${0.9 + h * 0.02}s`,
            }} />
          ))}
        </div>
        <div className="fs-sans a-fade-up" style={{
          animationDelay: '1.2s', marginTop: 32, fontSize: 18, lineHeight: 1.5,
          color: 'rgba(42,6,69,0.85)', maxWidth: 280, margin: '32px auto 0',
        }}>
          {hour >= 0 && hour < 5 && t.peak_3am}
          {hour >= 5 && hour < 11 && t.peak_morning}
          {hour >= 11 && hour < 17 && t.peak_midday}
          {hour >= 17 && hour < 22 && t.peak_evening}
          {hour >= 22 && t.peak_late}
        </div>
      </div>
    </SlideShell>
  );
})

const SlideNight = React.memo(function SlideNight({ a, u, t }) {
  const pct = useAnimatedNumber(Math.round(u.nightPct), 1400, [u.author]);
  return (
    <SlideShell bg="#577590" accent="#277da1">
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {[20, 50, 80].map((left, i) => (
          <div key={i} className="a-float" style={{
            position: 'absolute', left: `${left}%`, bottom: 100, fontSize: 24,
            animationDelay: `${i * 0.8}s`,
          }}>🌙</div>
        ))}
      </div>
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        textAlign: 'center', padding: '0 24px',
      }}>
        <div className="fs-sans a-fade-up" style={{ fontSize: 12, color: '#277da1', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase' }}>
          {t.night_eyebrow}
        </div>
        <div className="fs-display a-spring" style={{
          animationDelay: '0.2s', fontSize: 64, lineHeight: 1.1,
          letterSpacing: '-0.04em', color: '#277da1', marginTop: 48, fontWeight: 800,
        }}>
          {pct}<span style={{ fontSize: 32 }}>%</span>
        </div>
        <div className="fs-display a-fade-up" style={{
          animationDelay: '0.6s', fontSize: 20, fontStyle: 'italic', marginTop: 10, fontWeight: 700, color: '#2a0645',
        }}>
          {t.night_of_msgs}
        </div>
        <div className="fs-mono a-fade-up" style={{
          animationDelay: '0.9s', fontSize: 16, color: 'rgba(42,6,69,0.82)',
          marginTop: 16, letterSpacing: '0.08em',
        }}>
          {interp(t.night_count, {
            night: u.nightMessages.toLocaleString(),
            total: u.messageCount.toLocaleString(),
          })}
        </div>
        <div className="fs-sans a-fade-up" style={{
          animationDelay: '1.2s', marginTop: 32, fontSize: 18, lineHeight: 1.5,
          color: 'rgba(42,6,69,0.85)', maxWidth: 280, margin: '32px auto 0',
        }}>
          {u.nightPct > 30 && t.night_diag_strong}
          {u.nightPct > 15 && u.nightPct <= 30 && t.night_diag_med}
          {u.nightPct <= 15 && u.nightPct > 5 && t.night_diag_low}
          {u.nightPct <= 5 && t.night_diag_none}
        </div>
        {a.nightOwl?.author === u.author && (
          <div className="fs-sans a-fade-up" style={{
            animationDelay: '1.5s', fontSize: 12, color: '#f9c74f',
            marginTop: 20, letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase',
          }}>
            {t.night_owl}
          </div>
        )}
      </div>
    </SlideShell>
  );
})

const SlideStreak = React.memo(function SlideStreak({ u, t }) {
  const days = useAnimatedNumber(u.longestStreak, 1200, [u.author]);
  const dotCount = Math.min(u.longestStreak, 30);
  return (
    <SlideShell bg="#f3722c" accent="#f9c74f">
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        textAlign: 'center', padding: '0 24px',
      }}>
        <div className="fs-sans a-fade-up" style={{ fontSize: 12, color: '#f9c74f', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase' }}>
          {t.streak_eyebrow}
        </div>
        <div className="a-spring" style={{ animationDelay: '0.2s', marginTop: 48 }}>
          <div className="fs-display" style={{
            fontSize: 64, lineHeight: 1.1, letterSpacing: '-0.04em',
            color: '#f9c74f', fontWeight: 800,
          }}>
            {days}
          </div>
          <div className="fs-display" style={{
            fontSize: 20, fontStyle: 'italic', marginTop: 10, fontWeight: 700, color: '#2a0645',
          }}>
            {u.longestStreak === 1 ? t.streak_day : t.streak_days}
          </div>
        </div>
        <div className="a-fade-up" style={{
          display: 'flex', justifyContent: 'center', gap: 4, flexWrap: 'wrap',
          maxWidth: 240, margin: '40px auto 0',
          animationDelay: '0.8s',
        }}>
          {Array.from({ length: dotCount }).map((_, i) => (
            <div key={i} style={{
              width: 8, height: 8, borderRadius: 2,
              background: '#fff',
              opacity: 0.3 + (i / dotCount) * 0.7,
              animation: `scaleIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) ${1 + i * 0.03}s both`,
            }} />
          ))}
        </div>
      </div>
    </SlideShell>
  );
})

const SlideSpeed = React.memo(function SlideSpeed({ a, u, t }) {
  if (u.avgRespMin == null) return null;
  const respTime = u.avgRespMin;
  const display = respTime < 1 ? `${Math.round(respTime * 60)}s`
    : respTime < 60 ? `${respTime.toFixed(1)}m`
    : `${(respTime / 60).toFixed(1)}h`;
  const pct = u.speedPercentile ?? 50;
  return (
    <SlideShell bg="#577590" accent="#277da1">
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        textAlign: 'center', padding: '0 24px',
      }}>
        <div className="fs-sans a-fade-up" style={{ fontSize: 12, color: '#277da1', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase' }}>
          {t.speed_eyebrow}
        </div>
        <div className="fs-display a-spring" style={{
          animationDelay: '0.2s', fontSize: 56, lineHeight: 1.1,
          letterSpacing: '-0.04em', color: '#277da1', marginTop: 48, fontWeight: 800,
        }}>
          {display}
        </div>
        <div className="a-fade-up" style={{ animationDelay: '0.8s', marginTop: 40 }}>
          <div className="fs-display" style={{
            fontSize: 28, lineHeight: 1.2, letterSpacing: '-0.02em', fontStyle: 'italic', fontWeight: 700, color: '#2a0645',
          }}>
            {t.speed_faster}<br/>
            <span style={{ color: '#277da1', fontStyle: 'normal' }}>{pct}%</span> {t.speed_of_group}
          </div>
        </div>
        <div className="fs-sans a-fade-up" style={{
          animationDelay: '1.3s', marginTop: 24, fontSize: 12, color: 'rgba(42,6,69,0.75)', letterSpacing: '0.12em', fontWeight: 500, textTransform: 'uppercase',
        }}>
          {interp(t.speed_based, { n: u.respSampleSize })}
        </div>
      </div>
    </SlideShell>
  );
})

const SlideWord = React.memo(function SlideWord({ u, t }) {
  const word = u.topWord;
  return (
    <SlideShell bg="#577590" accent="#f9c74f">
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        textAlign: 'center', padding: '0 24px',
      }}>
        <div className="fs-sans a-fade-up" style={{ fontSize: 12, color: '#f9c74f', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase' }}>
          {t.word_eyebrow}
        </div>
        <div className="a-spring" style={{ animationDelay: '0.3s', marginTop: 48 }}>
          <div className="fs-display" style={{
            fontSize: word.length > 10 ? 40 : word.length > 6 ? 56 : 64,
            lineHeight: 1.1, letterSpacing: '-0.03em', color: '#f9c74f',
            fontStyle: 'italic', wordBreak: 'break-word', fontWeight: 800,
          }}>
            "{word}"
          </div>
        </div>
        <div className="fs-sans a-fade-up" style={{
          animationDelay: '1.0s', marginTop: 40, fontSize: 18, lineHeight: 1.5, color: 'rgba(42,6,69,0.85)',
        }}>
          {interp(t.word_used, { n: u.topWordCount })}
        </div>
      </div>
    </SlideShell>
  );
})

const SlideTopWords = React.memo(function SlideTopWords({ a, t }) {
  const words = (a.topWordsGroup || []).slice(0, 5);
  if (words.length === 0) return null;
  const maxCount = words[0].count;

  return (
    <SlideShell bg="#f9c74f" accent="#577590">
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column',
        padding: '32px 24px 24px',
      }}>
        <div className="fs-sans a-fade-up" style={{
          textAlign: 'center', fontSize: 12, color: '#577590', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase',
        }}>
          {t.top_words_eyebrow}
        </div>
        <div className="fs-display a-fade-up" style={{
          textAlign: 'center', animationDelay: '0.2s',
          fontSize: 32, lineHeight: 1.15, letterSpacing: '-0.03em', fontWeight: 700, color: '#1a1a2e',
          marginTop: 12, marginBottom: 20,
        }}>
          {t.top_words_title}<br/><span style={{ fontStyle: 'italic', color: '#577590' }}>{t.top_words_subtitle}</span>
        </div>
        <div className="no-sb" style={{
          flex: 1, overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          {words.map((w, i) => {
            const pct = Math.max(8, Math.round((w.count / maxCount) * 100));
            return (
              <div key={w.word} dir="auto" className="a-slide-up-far" style={{
                position: 'relative',
                padding: '16px 20px',
                background: 'rgba(87,117,144,0.08)',
                borderRadius: 18,
                overflow: 'hidden',
                animationDelay: `${0.5 + i * 0.13}s`,
              }}>
                <div className="a-slide-right" style={{
                  position: 'absolute', top: 0, bottom: 0, insetInlineStart: 0,
                  background: 'linear-gradient(90deg, rgba(87,117,144,0.14) 0%, rgba(87,117,144,0.02) 100%)',
                  width: `${pct}%`,
                  animationDelay: `${0.7 + i * 0.13}s`,
                  pointerEvents: 'none',
                }} />
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div className="fs-display" style={{
                    fontSize: 24, fontWeight: 800, color: i === 0 ? '#577590' : 'rgba(87,117,144,0.35)',
                    width: 28, flexShrink: 0, lineHeight: 1,
                  }}>
                    {i + 1}
                  </div>
                  <div className="fs-display" style={{
                    flex: 1, minWidth: 0,
                    fontSize: w.word.length > 12 ? 18 : w.word.length > 8 ? 22 : 28,
                    lineHeight: 1.1, letterSpacing: '-0.02em',
                    fontStyle: 'italic', color: '#1a1a2e', fontWeight: 700,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    "{w.word}"
                  </div>
                  <div className="fs-mono" style={{
                    fontSize: 16, color: '#577590', fontWeight: 700,
                    letterSpacing: '0.05em', flexShrink: 0,
                  }}>
                    {w.count.toLocaleString()}×
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SlideShell>
  );
})

const SlideEmoji = React.memo(function SlideEmoji({ a, u, t }) {
  return (
    <SlideShell bg="#f3722c" accent="#f9c74f">
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {[15, 40, 65, 85].map((left, i) => (
          <div key={i} className="a-float" style={{
            position: 'absolute', left: `${left}%`, bottom: 80, fontSize: 28,
            animationDelay: `${i * 0.6}s`,
          }}>{u.topEmoji}</div>
        ))}
      </div>
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        textAlign: 'center', padding: '0 24px',
      }}>
        <div className="fs-sans a-fade-up" style={{ fontSize: 12, color: '#f9c74f', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase' }}>
          {t.emoji_eyebrow}
        </div>
        <div className="a-spring" style={{
          animationDelay: '0.2s', fontSize: 100, lineHeight: 1, marginTop: 48,
        }}>
          {u.topEmoji}
        </div>
        <div className="fs-sans a-fade-up" style={{
          animationDelay: '0.8s', marginTop: 40, fontSize: 18, color: 'rgba(42,6,69,0.88)', lineHeight: 1.4,
        }}>
          {interp(t.emoji_used, { n: u.topEmojiCount })}
        </div>
      </div>
    </SlideShell>
  );
})

// The Novelist — group reveal of the longest-average-message writer (by chars)
const SlideNovelist = React.memo(function SlideNovelist({ a, t }) {
  const n = a.novelist;
  if (!n) return null;
  const chars = Math.round(n.avgCharsPerMsg);
  const name = n.author;
  return (
    <SlideShell bg="#577590" accent="#8338ec">
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        textAlign: 'center', padding: '0 24px',
      }}>
        <div className="a-spring" style={{ animationDelay: '0.1s', fontSize: 64, lineHeight: 1, marginBottom: 8 }}>✍️</div>
        <div className="fs-sans a-fade-up" style={{ fontSize: 12, color: '#8338ec', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase' }}>
          {t.novelist_eyebrow}
        </div>
        <div className="a-spring" style={{ animationDelay: '0.3s', marginTop: 24 }}>
          <div className="fs-display" dir="auto" style={{
            fontSize: name.length > 10 ? 40 : name.length > 6 ? 52 : 60,
            lineHeight: 1.05, letterSpacing: '-0.03em', color: '#8338ec',
            fontStyle: 'italic', wordBreak: 'break-word', fontWeight: 800,
          }}>
            {name}
          </div>
        </div>
        <div className="a-fade-up" style={{ animationDelay: '0.9s', marginTop: 36 }}>
          <div className="fs-display" style={{ fontSize: 48, fontWeight: 800, color: '#2a0645', letterSpacing: '-0.03em', lineHeight: 1 }}>
            {chars.toLocaleString()}
          </div>
          <div className="fs-sans" style={{ marginTop: 8, fontSize: 16, color: 'rgba(42,6,69,0.85)', lineHeight: 1.4 }}>
            {interp(t.novelist_chars, { n: chars, words: Math.round(n.avgWordsPerMsg) })}
          </div>
        </div>
      </div>
    </SlideShell>
  );
})

// The Ghoster — group reveal of the slowest average replier
const SlideGhoster = React.memo(function SlideGhoster({ a, t }) {
  const g = a.slowResponder;
  if (!g || g.avgRespMin == null) return null;
  const rt = g.avgRespMin;
  const display = rt < 60 ? `${rt.toFixed(0)}m`
    : rt < 1440 ? `${(rt / 60).toFixed(1)}h`
    : `${(rt / 1440).toFixed(1)}d`;
  const name = g.author;
  return (
    <SlideShell bg="#2a0645" accent="#577590">
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {[20, 55, 82].map((left, i) => (
          <div key={i} className="a-float" style={{
            position: 'absolute', left: `${left}%`, bottom: 90, fontSize: 30,
            opacity: 0.5, animationDelay: `${i * 0.7}s`,
          }}>👻</div>
        ))}
      </div>
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        textAlign: 'center', padding: '0 24px',
      }}>
        <div className="a-spring" style={{ animationDelay: '0.1s', fontSize: 72, lineHeight: 1, marginBottom: 8 }}>👻</div>
        <div className="fs-sans a-fade-up" style={{ fontSize: 12, color: '#577590', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase' }}>
          {t.ghoster_eyebrow}
        </div>
        <div className="a-spring" style={{ animationDelay: '0.3s', marginTop: 24 }}>
          <div className="fs-display" dir="auto" style={{
            fontSize: name.length > 10 ? 40 : name.length > 6 ? 52 : 60,
            lineHeight: 1.05, letterSpacing: '-0.03em', color: '#577590',
            fontStyle: 'italic', wordBreak: 'break-word', fontWeight: 800,
          }}>
            {name}
          </div>
        </div>
        <div className="a-fade-up" style={{ animationDelay: '0.9s', marginTop: 36 }}>
          <div className="fs-display" style={{ fontSize: 48, fontWeight: 800, color: '#2a0645', letterSpacing: '-0.03em', lineHeight: 1 }}>
            {display}
          </div>
          <div className="fs-sans" style={{ marginTop: 8, fontSize: 16, color: 'rgba(42,6,69,0.85)', lineHeight: 1.4 }}>
            {interp(t.ghoster_reply, { n: g.respSampleSize })}
          </div>
        </div>
      </div>
    </SlideShell>
  );
})

// Vibe Check — the SELECTED participant's top-5 words + most-used emojis
const SlideVibeCheck = React.memo(function SlideVibeCheck({ u, t }) {
  const words = (u.top5Words || []).filter(w => w.count > 0);
  const emojis = (u.top5Emojis || []).filter(e => e.count > 0);
  if (words.length === 0 && emojis.length === 0) return null;
  const maxCount = words.length ? words[0].count : 1;
  return (
    <SlideShell bg="#f94144" accent="#f94144">
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', padding: '32px 24px 24px',
      }}>
        <div className="fs-sans a-fade-up" style={{ textAlign: 'center', fontSize: 12, color: '#f94144', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase' }}>
          {t.vibe_eyebrow}
        </div>
        <div className="fs-display a-fade-up" dir="auto" style={{
          textAlign: 'center', animationDelay: '0.15s',
          fontSize: 30, lineHeight: 1.15, letterSpacing: '-0.03em', fontWeight: 800, color: '#1a1a2e',
          marginTop: 10, marginBottom: 16,
        }}>
          {interp(t.vibe_title, { name: u.author })}
        </div>
        {emojis.length > 0 && (
          <div className="a-fade-up" style={{ animationDelay: '0.4s', display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
            {emojis.map((e, i) => (
              <div key={e.emoji} className="a-spring" style={{ animationDelay: `${0.5 + i * 0.1}s`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <div style={{ fontSize: i === 0 ? 40 : 30, lineHeight: 1 }}>{e.emoji}</div>
                <div className="fs-mono" style={{ fontSize: 11, color: 'rgba(26,26,46,0.6)', fontWeight: 700 }}>{e.count}×</div>
              </div>
            ))}
          </div>
        )}
        <div className="no-sb" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {words.map((w, i) => {
            const pct = Math.max(8, Math.round((w.count / maxCount) * 100));
            return (
              <div key={w.word} dir="auto" className="a-slide-up-far" style={{
                position: 'relative', padding: '13px 18px',
                background: 'rgba(249,65,68,0.08)', borderRadius: 16,
                overflow: 'hidden', animationDelay: `${0.7 + i * 0.12}s`,
              }}>
                <div className="a-slide-right" style={{
                  position: 'absolute', top: 0, bottom: 0, insetInlineStart: 0,
                  background: 'linear-gradient(90deg, rgba(249,65,68,0.16) 0%, rgba(249,65,68,0.02) 100%)',
                  width: `${pct}%`, animationDelay: `${0.9 + i * 0.12}s`, pointerEvents: 'none',
                }} />
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="fs-display" style={{ fontSize: 20, fontWeight: 800, color: i === 0 ? '#f94144' : 'rgba(249,65,68,0.4)', width: 24, flexShrink: 0, lineHeight: 1 }}>
                    {i + 1}
                  </div>
                  <div className="fs-display" style={{
                    flex: 1, minWidth: 0,
                    fontSize: w.word.length > 12 ? 17 : w.word.length > 8 ? 20 : 24,
                    lineHeight: 1.1, letterSpacing: '-0.02em',
                    fontStyle: 'italic', color: '#1a1a2e', fontWeight: 700,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    "{w.word}"
                  </div>
                  <div className="fs-mono" style={{ fontSize: 14, color: '#f94144', fontWeight: 700, letterSpacing: '0.05em', flexShrink: 0 }}>
                    {w.count.toLocaleString()}×
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SlideShell>
  );
})

const SlideDramaRole = React.memo(function SlideDramaRole({ u, t }) {
  // Determine role based on actual computed data
  let titleText, count, labelText, copyText, accent, bg;
  if (u.conversationsRevived > u.conversationsKilled && u.conversationsRevived >= 5) {
    titleText = t.drama_defib;
    count = u.conversationsRevived;
    labelText = t.drama_defib_label;
    copyText = t.drama_defib_copy;
    accent = '#277da1';
    bg = '#577590';
  } else if (u.conversationsKilled > u.conversationsRevived && u.conversationsKilled >= 5) {
    titleText = t.drama_killer;
    count = u.conversationsKilled;
    labelText = t.drama_killer_label;
    copyText = t.drama_killer_copy;
    accent = '#f3722c';
    bg = '#577590';
  } else if (u.replyReceivedRate > 0.5 && u.messageCount >= 20) {
    titleText = t.drama_replied;
    count = Math.round(u.replyReceivedRate * 100);
    labelText = t.drama_replied_label;
    copyText = t.drama_replied_copy;
    accent = '#f9c74f';
    bg = '#f3722c';
  } else if (u.ignoredRate > 0.25 && u.messageCount >= 20) {
    titleText = t.drama_ignored;
    count = Math.round(u.ignoredRate * 100);
    labelText = t.drama_ignored_label;
    copyText = t.drama_ignored_copy;
    accent = '#577590';
    bg = '#f9c74f';
  } else {
    titleText = t.drama_steady;
    count = u.finalMessagesOfDay;
    labelText = t.drama_steady_label;
    copyText = t.drama_steady_copy;
    accent = '#277da1';
    bg = '#577590';
  }

  const animated = useAnimatedNumber(count, 1400, [u.author]);
  const isPercent = labelText.startsWith('%');
  const cleanLabel = isPercent ? labelText.slice(1).trim() : labelText;
  const isLightBg = bg === '#f9c74f';
  const bodyColor = isLightBg ? 'rgba(87,117,144,0.88)' : 'rgba(42,6,69,0.85)';
  const heroColor = isLightBg ? '#1a1a2e' : '#2a0645';

  return (
    <SlideShell bg={bg} accent={accent}>
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        textAlign: 'center', padding: '0 24px',
      }}>
        <div className="fs-sans a-fade-up" style={{ fontSize: 12, color: accent, letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase' }}>
          {t.drama_eyebrow}
        </div>
        <div className="a-spring" style={{ animationDelay: '0.3s', marginTop: 32 }}>
          <div className="fs-display" style={{
            fontSize: titleText.length > 20 ? 28 : 36,
            lineHeight: 1.15, letterSpacing: '-0.03em', fontStyle: 'italic', color: accent, fontWeight: 700,
          }}>
            {titleText}
          </div>
        </div>
        <div className="a-spring" style={{ animationDelay: '0.7s', marginTop: 40 }}>
          <div className="fs-display" style={{
            fontSize: 56, lineHeight: 1.1, letterSpacing: '-0.04em', color: heroColor, fontWeight: 800,
          }}>
            {animated}{isPercent ? '%' : ''}
          </div>
          <div className="fs-mono" style={{
            fontSize: 16, color: bodyColor, letterSpacing: '0.08em', marginTop: 8,
          }}>
            {cleanLabel}
          </div>
        </div>
        <div className="fs-sans a-fade-up" style={{
          animationDelay: '1.3s', marginTop: 32, fontSize: 18, lineHeight: 1.5, color: bodyColor,
        }}>
          {copyText}
        </div>
      </div>
    </SlideShell>
  );
})

const SlideRoast = React.memo(function SlideRoast({ u, profile, t }) {
  const tone = profile?.tone || 'medium';
  const roasts = u.roasts.slice(0, 2);
  const heading = tone === 'mild' ? t.roast_heading_mild
    : tone === 'spicy' ? t.roast_heading_spicy
    : t.roast_heading_med;
  const eyebrow = tone === 'spicy' ? t.roast_eyebrow_spicy
    : tone === 'mild' ? t.roast_eyebrow_mild
    : t.roast_eyebrow_med;
  return (
    <SlideShell bg="#577590" accent="#f3722c">
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '0 22px',
      }}>
        <div className="fs-sans a-fade-up" style={{
          fontSize: 12, color: '#f3722c', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase',
        }}>
          {eyebrow}
        </div>
        <div className="fs-display a-fade-up" style={{
          animationDelay: '0.15s', fontSize: 32, lineHeight: 1.15,
          letterSpacing: '-0.03em', marginTop: 16, fontStyle: 'italic', fontWeight: 700, color: '#2a0645',
        }}>
          {heading}
        </div>
        <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {roasts.map((roast, i) => (
            <div key={i} className="a-roast-card" style={{
              position: 'relative', overflow: 'hidden',
              padding: '20px 22px 18px',
              background: 'rgba(42,6,69,0.06)',
              borderRadius: 20,
              animationDelay: `${0.5 + i * 0.5}s`,
            }}>
              <div className="fs-sans" style={{
                fontSize: 12, color: '#f3722c', letterSpacing: '0.15em',
                opacity: 0.70, marginBottom: 10, fontWeight: 500, textTransform: 'uppercase',
              }}>
                #{String(i + 1).padStart(2, '0')}
              </div>
              <div className="fs-sans" style={{
                fontSize: 18, lineHeight: 1.45, letterSpacing: '-0.01em',
                color: '#2a0645', fontWeight: 400,
              }}>
                {interp(t[roast.lineKey] || '', roast.vars || {})}
              </div>
              {tone !== 'mild' && (
                <div className="fs-display" style={{
                  marginTop: 10, fontSize: 16, lineHeight: 1.4, letterSpacing: '-0.01em',
                  color: '#f3722c', fontStyle: 'italic', fontWeight: 700,
                }}>
                  {interp(t[roast.kickerKey] || '', roast.vars || {})}
                </div>
              )}
            </div>
          ))}
        </div>
        {u.roasts.length > 2 && (
          <div className="fs-sans a-fade-up" style={{
            animationDelay: '1.8s', textAlign: 'center', marginTop: 16,
            fontSize: 12, color: 'rgba(42,6,69,0.75)', letterSpacing: '0.12em', fontWeight: 500,
          }}>
            {interp(t.roast_more, { n: u.roasts.length - 2 })}
          </div>
        )}
      </div>
    </SlideShell>
  );
})

const SlideAchievements = React.memo(function SlideAchievements({ achievements, t }) {
  const top = achievements.slice(0, 3);
  return (
    <SlideShell bg="#577590" accent="#f94144">
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '0 24px',
      }}>
        <div className="fs-sans a-fade-up" style={{ fontSize: 12, color: '#f94144', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase' }}>
          {t.ach_eyebrow}
        </div>
        <div className="fs-display a-fade-up" style={{
          animationDelay: '0.2s', fontSize: 32, lineHeight: 1.15,
          letterSpacing: '-0.03em', marginTop: 20, fontWeight: 700, color: '#2a0645',
        }}>
          {t.ach_earned}<br/>
          <span style={{ fontStyle: 'italic', color: '#f94144' }}>{achievements.length}</span>{' '}
          {achievements.length === 1 ? t.ach_badges : t.ach_badges_plural}.
        </div>
        <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {top.map((ach, i) => (
            <div key={i} className="a-spring" style={{
              position: 'relative', overflow: 'hidden', padding: '20px 22px',
              background: `linear-gradient(135deg, ${ach.color}25 0%, ${ach.color}08 100%)`,
              borderRadius: 20,
              animationDelay: `${0.5 + i * 0.2}s`,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ fontSize: 28, lineHeight: 1 }}>🏆</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="fs-display" style={{
                    fontSize: 18, lineHeight: 1.2, color: ach.color, letterSpacing: '-0.01em', fontWeight: 700,
                  }}>
                    {t[ach.labelKey] || ach.labelKey}
                  </div>
                  <div className="fs-sans" style={{
                    fontSize: 16, color: 'rgba(42,6,69,0.82)', marginTop: 6, lineHeight: 1.4,
                  }}>
                    {interp(t[ach.evidenceKey] || '', ach.vars || {})}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        {achievements.length > 3 && (
          <div className="fs-sans a-fade-up" style={{
            animationDelay: '1.5s', textAlign: 'center', marginTop: 16,
            fontSize: 12, color: 'rgba(42,6,69,0.72)', letterSpacing: '0.12em', fontWeight: 500,
          }}>
            {interp(t.ach_more, { n: achievements.length - 3 })}
          </div>
        )}
      </div>
    </SlideShell>
  );
})

const SlideMostLikely = React.memo(function SlideMostLikely({ a, t }) {
  return (
    <SlideShell bg="#577590" accent="#277da1">
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column',
        padding: '32px 24px 24px',
      }}>
        <div className="fs-sans a-fade-up" style={{
          textAlign: 'center', fontSize: 12, color: '#277da1', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase',
        }}>
          {t.likely_eyebrow}
        </div>
        <div className="fs-display a-fade-up" style={{
          textAlign: 'center', animationDelay: '0.2s',
          fontSize: 32, lineHeight: 1.15, letterSpacing: '-0.03em', fontWeight: 700, color: '#2a0645',
          marginTop: 12, marginBottom: 20,
        }}>
          {t.likely_title}<br/><span style={{ fontStyle: 'italic', color: '#277da1' }}>{t.likely_verdicts}</span>
        </div>
        <div className="no-sb" style={{
          flex: 1, overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          {a.mostLikely.map((card, i) => (
            <div key={i} className="a-slide-right" style={{
              padding: '16px 20px',
              background: 'rgba(39,125,161,0.08)',
              borderRadius: 18,
              animationDelay: `${0.5 + i * 0.11}s`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: 22, lineHeight: 1 }}>{card.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="fs-sans" style={{
                    fontSize: 12, color: '#277da1', letterSpacing: '0.12em', fontWeight: 500, textTransform: 'uppercase',
                  }}>
                    {t.likely_label}
                  </div>
                  <div className="fs-sans" style={{ fontSize: 16, color: '#2a0645', marginTop: 4, fontWeight: 500, lineHeight: 1.3 }}>
                    {t[card.labelKey] || card.labelKey}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="fs-display" style={{
                    fontSize: 18, color: '#277da1', fontStyle: 'italic', fontWeight: 700,
                    letterSpacing: '-0.02em', maxWidth: 100,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {card.winner}
                  </div>
                  <div className="fs-mono" style={{ fontSize: 14, color: 'rgba(42,6,69,0.72)', marginTop: 4 }}>
                    {card.metric}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </SlideShell>
  );
})

const SlideDuo = React.memo(function SlideDuo({ a, u, t }) {
  const [n1, n2] = a.topDuo.names;
  const isInDuo = n1 === u.author || n2 === u.author;
  const partner = n1 === u.author ? n2 : n1;
  return (
    <SlideShell bg="#f3722c" accent="#f94144">
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        textAlign: 'center', padding: '0 24px',
      }}>
        <div className="fs-sans a-fade-up" style={{
          fontSize: 12, color: '#f94144', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase',
        }}>
          {t.duo_eyebrow}
        </div>
        <div className="a-spring" style={{ animationDelay: '0.3s', marginTop: 40 }}>
          <div className="fs-display" style={{
            fontSize: 36, lineHeight: 1.15, letterSpacing: '-0.03em', fontWeight: 700,
          }}>
            <span style={{ fontStyle: 'italic', color: '#f94144' }}>{n1}</span>
            <span style={{ display: 'block', margin: '12px 0', fontSize: 16, color: 'rgba(42,6,69,0.75)' }}>&</span>
            <span style={{ fontStyle: 'italic', color: '#f94144' }}>{n2}</span>
          </div>
        </div>
        <div className="a-fade-up" style={{ animationDelay: '0.9s', marginTop: 48 }}>
          <div className="fs-display" style={{
            fontSize: 24, lineHeight: 1.3, letterSpacing: '-0.02em', fontWeight: 700, color: '#2a0645',
          }}>
            {t.duo_traded} <span style={{ color: '#f94144' }}>{a.topDuo.count.toLocaleString()}</span><br/>
            {t.duo_replies_between}
          </div>
        </div>
        <div className="fs-sans a-fade-up" style={{
          animationDelay: '1.4s', marginTop: 32, fontSize: 18,
          color: 'rgba(42,6,69,0.85)', maxWidth: 280, margin: '32px auto 0', lineHeight: 1.45,
        }}>
          {isInDuo
            ? interp(t.duo_in_with, { partner })
            : interp(t.duo_share, { pct: a.topDuoShare.toFixed(0) })}
        </div>
      </div>
    </SlideShell>
  );
})

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const SlideEras = React.memo(function SlideEras({ a, t }) {
  return (
    <SlideShell bg="#577590" accent="#f9c74f">
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', padding: '32px 24px 24px',
      }}>
        <div className="fs-sans a-fade-up" style={{
          textAlign: 'center', fontSize: 12, color: '#f9c74f', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase',
        }}>
          {t.eras_eyebrow}
        </div>
        <div className="fs-display a-fade-up" style={{
          textAlign: 'center', animationDelay: '0.2s',
          fontSize: 32, lineHeight: 1.15, letterSpacing: '-0.03em', fontWeight: 700, color: '#2a0645',
          marginTop: 12, marginBottom: 20,
        }}>
          {t.eras_title}<br/><span style={{ fontStyle: 'italic', color: '#f9c74f' }}>{t.eras_subtitle}</span>
        </div>
        <div className="no-sb" style={{
          flex: 1, overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          {a.eras.map((era, i) => {
            const startMonth = MONTH_NAMES[era.startDate.getMonth()];
            const endMonth = MONTH_NAMES[era.endDate.getMonth()];
            const dateRange = startMonth === endMonth
              ? `${startMonth} ${era.startDate.getDate()}–${era.endDate.getDate()}`
              : `${startMonth} ${era.startDate.getDate()} – ${endMonth} ${era.endDate.getDate()}`;
            return (
              <div key={i} className="a-fade-up" style={{
                padding: '16px 20px',
                background: 'rgba(249,199,79,0.08)',
                borderRadius: 18,
                animationDelay: `${0.5 + i * 0.18}s`,
              }}>
                <div className="fs-sans" style={{
                  fontSize: 12, color: '#f9c74f', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase',
                }}>
                  {t.eras_chapter} {String(i + 1).padStart(2, '0')}
                </div>
                <div className="fs-display" style={{
                  fontSize: 20, lineHeight: 1.2, letterSpacing: '-0.02em',
                  marginTop: 4, fontStyle: 'italic', fontWeight: 700, color: '#2a0645',
                }}>
                  {era.name}
                </div>
                <div className="fs-mono" style={{
                  fontSize: 14, color: 'rgba(42,6,69,0.75)', marginTop: 6, letterSpacing: '0.03em',
                }}>
                  {dateRange} · {era.messageCount.toLocaleString()} {t.eras_msgs} · {interp(t.eras_per_day, { n: era.msgPerDay })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SlideShell>
  );
})

const SlideChaosMoment = React.memo(function SlideChaosMoment({ a, t }) {
  const cm = a.chaosMinute;
  const ts = cm.ts;
  const dateStr = `${MONTH_NAMES[ts.getMonth()]} ${ts.getDate()}`;
  const timeStr = `${String(ts.getHours()).padStart(2, '0')}:${String(ts.getMinutes()).padStart(2, '0')}`;
  const animated = useAnimatedNumber(cm.count, 1100, [ts.getTime()]);

  const bubbles = Array.from({ length: 8 }).map((_, i) => ({
    left: 10 + (i * 11) % 80,
    delay: i * 0.25,
  }));

  return (
    <SlideShell bg="#f3722c" accent="#f94144" shake={true}>
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        {bubbles.map((b, i) => (
          <div key={i} style={{
            position: 'absolute', left: `${b.left}%`, top: -30,
            width: 60, height: 26, borderRadius: 8,
            background: 'rgba(255,255,255,0.18)',
            animation: `notifRain 3s linear ${b.delay}s infinite`,
          }} />
        ))}
      </div>
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        textAlign: 'center', padding: '0 24px',
      }}>
        <div className="fs-sans a-fade-up" style={{
          fontSize: 12, color: '#f94144', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase',
        }}>
          {t.chaos_eyebrow}
        </div>
        <div className="a-fade-up" style={{ animationDelay: '0.3s', marginTop: 24 }}>
          <div className="fs-display" style={{
            fontSize: 32, lineHeight: 1.15, letterSpacing: '-0.03em', fontWeight: 700, color: '#2a0645',
          }}>
            <span style={{ fontStyle: 'italic' }}>{dateStr}</span>
            <span style={{ display: 'block', color: '#f94144', marginTop: 6 }}>
              {interp(t.chaos_at, { time: timeStr })}
            </span>
          </div>
        </div>
        <div className="a-spring" style={{ animationDelay: '0.8s', marginTop: 48 }}>
          <div className="fs-display" style={{
            fontSize: 56, lineHeight: 1.1, letterSpacing: '-0.04em', color: '#2a0645', fontWeight: 800,
          }}>
            {animated}
          </div>
          <div className="fs-display" style={{
            fontSize: 20, marginTop: 8, color: '#f94144', fontStyle: 'italic', fontWeight: 700,
          }}>
            {t.chaos_msgs_minute}
          </div>
        </div>
        <div className="fs-sans a-fade-up" style={{
          animationDelay: '1.6s', marginTop: 32, fontSize: 18, lineHeight: 1.5,
          color: 'rgba(42,6,69,0.85)', maxWidth: 280, margin: '32px auto 0',
        }}>
          {t.chaos_lost_control}
        </div>
      </div>
    </SlideShell>
  );
})

const SlideGroupPersona = React.memo(function SlideGroupPersona({ a, t }) {
  return (
    <SlideShell bg="#f9c74f" accent="#577590">
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '0 24px',
      }}>
        <div className="fs-sans a-fade-up" style={{
          fontSize: 12, color: '#577590', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase',
        }}>
          {t.persona_eyebrow}
        </div>
        <div className="fs-display a-fade-up" style={{
          animationDelay: '0.2s', fontSize: 20, lineHeight: 1.2,
          letterSpacing: '-0.02em', marginTop: 20, color: 'rgba(87,117,144,0.85)', fontWeight: 500,
        }}>
          {t.persona_this_group}
        </div>
        <div className="a-spring a-pulse-glow" style={{ animationDelay: '0.5s', marginTop: 24 }}>
          <div className="fs-display" style={{
            fontSize: 48, lineHeight: 1.1, letterSpacing: '-0.03em',
            color: '#577590', fontStyle: 'italic', fontWeight: 800,
          }}>
            {a.groupPersonality}
          </div>
        </div>
        <div className="a-fade-up" style={{ animationDelay: '1.2s', marginTop: 48 }}>
          <div className="fs-sans" style={{
            fontSize: 12, color: 'rgba(87,117,144,0.78)', letterSpacing: '0.12em', marginBottom: 10, fontWeight: 500, textTransform: 'uppercase',
          }}>
            {t.persona_evidence}
          </div>
          <div className="fs-sans" style={{ fontSize: 18, color: '#1a1a2e', lineHeight: 1.5, fontWeight: 400 }}>
            {a.groupPersonalityReason}
          </div>
        </div>
      </div>
    </SlideShell>
  );
})

const SlideAwards = React.memo(function SlideAwards({ a, t }) {
  // Only include awards with valid winners
  const awards = [
    a.fastestResponder && { trophy: '🏆', label: t.awards_fastest, winner: a.fastestResponder.author,
      sub: interp(t.awards_fastest_sub, { m: a.fastestResponder.avgRespMin.toFixed(1) }), color: '#277da1' },
    a.yapper && { trophy: '🎤', label: t.awards_yapper, winner: a.yapper.author,
      sub: interp(t.awards_yapper_sub, { n: a.yapper.messageCount.toLocaleString() }), color: '#f3722c' },
    a.nightOwl && a.nightOwl.nightPct > 5 && { trophy: '🌙', label: t.awards_nightowl,
      winner: a.nightOwl.author, sub: interp(t.awards_nightowl_sub, { pct: a.nightOwl.nightPct.toFixed(0) }), color: '#277da1' },
    a.ghost && a.ghost.longestAbsenceDays >= 7 && { trophy: '👻', label: t.awards_ghost,
      winner: a.ghost.author, sub: interp(t.awards_ghost_sub, { n: a.ghost.longestAbsenceDays }), color: '#2a0645' },
    a.killer && a.killer.conversationsKilled >= 3 && { trophy: '💀', label: t.awards_killer,
      winner: a.killer.author, sub: interp(t.awards_killer_sub, { n: a.killer.conversationsKilled }), color: '#f3722c' },
    a.reviver && a.reviver.conversationsRevived >= 3 && { trophy: '✨', label: t.awards_defib,
      winner: a.reviver.author, sub: interp(t.awards_defib_sub, { n: a.reviver.conversationsRevived }), color: '#277da1' },
  ].filter(Boolean).slice(0, 6);

  return (
    <SlideShell bg="#577590" accent="#f94144">
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', padding: '32px 24px 24px',
      }}>
        <div className="fs-sans a-fade-up" style={{
          textAlign: 'center', fontSize: 12, color: '#f94144', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase',
        }}>
          {t.awards_eyebrow}
        </div>
        <div className="fs-display a-fade-up" style={{
          textAlign: 'center', animationDelay: '0.2s',
          fontSize: 32, lineHeight: 1.15, letterSpacing: '-0.03em', fontWeight: 700, color: '#2a0645',
          marginTop: 10, marginBottom: 18,
        }}>
          {t.awards_title}<br/><span style={{ fontStyle: 'italic', color: '#f94144' }}>{t.awards_are}</span>
        </div>
        <div className="no-sb" style={{
          flex: 1, overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          {awards.map((aw, i) => (
            <div key={aw.label} className="a-slide-up-far" style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 20px',
              background: 'rgba(42,6,69,0.06)',
              borderRadius: 18,
              animationDelay: `${0.5 + i * 0.15}s`,
            }}>
              <div style={{ fontSize: 24, lineHeight: 1, flexShrink: 0 }}>{aw.trophy}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="fs-sans" style={{
                  fontSize: 12, color: aw.color, letterSpacing: '0.12em',
                  fontWeight: 500, textTransform: 'uppercase',
                }}>
                  {aw.label}
                </div>
                <div className="fs-sans" style={{
                  fontSize: 16, fontWeight: 700, marginTop: 3, lineHeight: 1.2, color: '#2a0645',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {aw.winner}
                </div>
              </div>
              <div className="fs-mono" style={{
                fontSize: 14, color: 'rgba(42,6,69,0.72)', textAlign: 'right', flexShrink: 0, lineHeight: 1.4,
              }}>
                {aw.sub}
              </div>
            </div>
          ))}
        </div>
      </div>
    </SlideShell>
  );
})

const SlidePeakDay = React.memo(function SlidePeakDay({ a, t }) {
  if (!a.peakDay) return null;
  const [date, count] = a.peakDay;
  const [yr, mo, dy] = date.split('-').map(Number);
  const dateObj = new Date(yr, mo - 1, dy);
  const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
  const dateStr = dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  const animated = useAnimatedNumber(count, 1400, [date]);

  return (
    <SlideShell bg="#f3722c" accent="#f9c74f">
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        textAlign: 'center', padding: '0 24px',
      }}>
        <div className="fs-sans a-fade-up" style={{
          fontSize: 12, color: '#f9c74f', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase',
        }}>
          {t.peakday_eyebrow}
        </div>
        <div className="fs-display a-fade-up" style={{
          animationDelay: '0.3s', fontSize: 32, lineHeight: 1.15,
          letterSpacing: '-0.03em', marginTop: 20, fontWeight: 700, color: '#2a0645',
        }}>
          <span style={{ fontStyle: 'italic' }}>{dayName},</span><br/>{dateStr}
        </div>
        <div className="fs-display a-spring" style={{
          animationDelay: '0.7s', fontSize: 64, lineHeight: 1.1,
          letterSpacing: '-0.04em', color: '#f9c74f', marginTop: 40, fontWeight: 800,
        }}>
          {animated}
        </div>
        <div className="fs-display a-fade-up" style={{
          animationDelay: '1.2s', fontSize: 20, marginTop: 10, fontStyle: 'italic', fontWeight: 700, color: '#2a0645',
        }}>
          {t.peakday_msgs}
        </div>
      </div>
    </SlideShell>
  );
})

const SlideFinale = React.memo(function SlideFinale({ a, t, onExit, onMenu }) {
  return (
    <SlideShell bg="#577590" accent="#f94144">
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        textAlign: 'center', padding: '0 24px',
      }}>
        <div className="fs-sans a-fade-up" style={{
          fontSize: 12, color: '#f94144', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase',
        }}>
          {t.finale_eyebrow}
        </div>
        <div className="a-spring" style={{ animationDelay: '0.3s', marginTop: 48 }}>
          <div className="fs-display" style={{
            fontSize: 52, lineHeight: 1.1, letterSpacing: '-0.04em', fontWeight: 800, color: '#2a0645',
          }}>
            <span style={{ display: 'block' }}>{t.finale_see}</span>
            <span style={{ display: 'block' }}>{t.finale_in_the}</span>
            <span style={{ display: 'block', fontStyle: 'italic', color: '#f94144' }}>{t.finale_chat}</span>
          </div>
        </div>
        <div className="fs-sans a-fade-up" style={{
          animationDelay: '1.0s', marginTop: 40, fontSize: 18, color: 'rgba(42,6,69,0.85)', lineHeight: 1.45,
        }}>
          {t.finale_now}
        </div>
        <div className="a-fade-up" style={{
          animationDelay: '1.4s', display: 'flex', gap: 8,
          justifyContent: 'center', marginTop: 32,
        }}>
          <button onClick={onMenu || onExit} className="press fs-sans" style={{
            padding: '14px 28px', background: '#f9c74f', color: '#0a0a0f',
            border: 'none', borderRadius: 999, fontSize: 18, fontWeight: 700, cursor: 'pointer',
          }}>
            {t.finale_explore}
          </button>
        </div>
      </div>
    </SlideShell>
  );
})

// ============================================================
// GROUP-FIRST TIGHT DECK — short, data-dense, screenshot-worthy.
// Every number comes from verified parsed analytics (no AI text).
// ============================================================

// 1) Group overview — totals, people, span, peak hour + busiest day
const SlideGroupOverview = React.memo(function SlideGroupOverview({ a, t }) {
  const peakHour = (a.groupHourly && a.groupHourly.length)
    ? a.groupHourly.indexOf(Math.max(...a.groupHourly)) : null;
  const fmt = (d) => { try { return new Date(d).toLocaleDateString(undefined, { month: 'short', year: '2-digit' }); } catch { return ''; } };
  const range = `${fmt(a.start)} – ${fmt(a.end)}`;
  let peakDayStr = null, peakDayCount = null;
  if (a.peakDay) {
    const [date, count] = a.peakDay;
    const [yr, mo, dy] = date.split('-').map(Number);
    peakDayStr = new Date(yr, mo - 1, dy).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    peakDayCount = count;
  }
  const tiles = [
    { big: a.totalMessages.toLocaleString(), label: t.go_messages, color: '#573280' },
    { big: String(a.totalParticipants), label: t.go_people, color: '#f3722c' },
    { big: String(a.durationDays), label: t.go_days, sub: range, color: '#277da1' },
    { big: peakHour != null ? `${String(peakHour).padStart(2, '0')}:00` : '—', label: t.go_peakhour, color: '#8338ec' },
  ];
  return (
    <SlideShell bg="#577590" accent="#573280">
      <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', padding: '36px 24px 24px' }}>
        <div className="fs-sans a-fade-up" style={{ textAlign: 'center', fontSize: 12, color: '#573280', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase' }}>{t.go_eyebrow}</div>
        <div className="fs-display a-fade-up" style={{ textAlign: 'center', animationDelay: '0.15s', fontSize: 30, lineHeight: 1.12, letterSpacing: '-0.03em', fontWeight: 800, color: '#2a0645', marginTop: 8, marginBottom: 18 }}>{t.go_title}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {tiles.map((tile, i) => (
            <div key={i} className="a-slide-up-far" style={{ background: 'rgba(42,6,69,0.06)', borderRadius: 18, padding: '18px 16px', textAlign: 'center', animationDelay: `${0.4 + i * 0.12}s` }}>
              <div className="fs-display" style={{ fontSize: tile.big.length > 6 ? 28 : 34, fontWeight: 800, color: tile.color, letterSpacing: '-0.03em', lineHeight: 1 }}>{tile.big}</div>
              <div className="fs-sans" style={{ marginTop: 6, fontSize: 12, color: 'rgba(42,6,69,0.7)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 500 }}>{tile.label}</div>
              {tile.sub && <div className="fs-mono" style={{ marginTop: 4, fontSize: 11, color: 'rgba(42,6,69,0.55)' }}>{tile.sub}</div>}
            </div>
          ))}
        </div>
        {peakDayStr && (
          <div className="a-fade-up" style={{ animationDelay: '0.9s', marginTop: 14, textAlign: 'center', background: 'rgba(243,114,44,0.1)', borderRadius: 16, padding: '14px 16px' }}>
            <span className="fs-sans" style={{ fontSize: 12, color: '#f3722c', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>{t.go_busiest} </span>
            <span className="fs-display" style={{ fontSize: 18, fontWeight: 800, color: '#2a0645' }}>{peakDayStr}</span>
            <span className="fs-mono" style={{ fontSize: 13, color: 'rgba(42,6,69,0.6)' }}> · {interp(t.go_busiest_msgs, { n: peakDayCount.toLocaleString() })}</span>
          </div>
        )}
      </div>
    </SlideShell>
  );
})

// 2) Leaderboard — full ranking by messages, quietest flagged
const SlideLeaderboard = React.memo(function SlideLeaderboard({ a, t }) {
  const users = a.users || [];
  if (users.length === 0) return null;
  const max = users[0].messageCount || 1;
  const medals = ['🥇', '🥈', '🥉'];
  return (
    <SlideShell bg="#f3722c" accent="#f3722c">
      <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', padding: '32px 22px 22px' }}>
        <div className="fs-sans a-fade-up" style={{ textAlign: 'center', fontSize: 12, color: '#f3722c', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase' }}>{t.lb_eyebrow}</div>
        <div className="fs-display a-fade-up" style={{ textAlign: 'center', animationDelay: '0.15s', fontSize: 30, lineHeight: 1.12, letterSpacing: '-0.03em', fontWeight: 800, color: '#2a0645', marginTop: 8, marginBottom: 16 }}>{t.lb_title}</div>
        <div className="no-sb" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {users.map((usr, i) => {
            const pct = Math.max(6, Math.round((usr.messageCount / max) * 100));
            const last = i === users.length - 1 && users.length > 1;
            return (
              <div key={usr.author} dir="auto" className="a-slide-up-far" style={{ position: 'relative', padding: '12px 16px', background: last ? 'rgba(87,117,144,0.12)' : 'rgba(243,114,44,0.08)', borderRadius: 14, overflow: 'hidden', animationDelay: `${0.4 + i * 0.08}s` }}>
                <div className="a-slide-right" style={{ position: 'absolute', top: 0, bottom: 0, insetInlineStart: 0, background: 'linear-gradient(90deg, rgba(243,114,44,0.16) 0%, rgba(243,114,44,0.02) 100%)', width: `${pct}%`, animationDelay: `${0.6 + i * 0.08}s`, pointerEvents: 'none' }} />
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="fs-display" style={{ width: 26, flexShrink: 0, fontSize: i < 3 ? 20 : 14, textAlign: 'center', color: 'rgba(42,6,69,0.5)' }}>{i < 3 ? medals[i] : (i + 1)}</div>
                  <div className="fs-sans" style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: 700, color: '#2a0645', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {usr.author}{last && <span style={{ fontSize: 11, color: '#577590', fontWeight: 600 }}> · {t.lb_least}</span>}
                  </div>
                  <div className="fs-mono" style={{ flexShrink: 0, fontSize: 15, fontWeight: 700, color: '#f3722c' }}>{usr.messageCount.toLocaleString()}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SlideShell>
  );
})

// 3) Per-person — messages, share %, words, avg words/msg
const SlidePerPerson = React.memo(function SlidePerPerson({ a, t }) {
  const users = a.users || [];
  if (users.length === 0) return null;
  return (
    <SlideShell bg="#577590" accent="#277da1">
      <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', padding: '32px 22px 22px' }}>
        <div className="fs-sans a-fade-up" style={{ textAlign: 'center', fontSize: 12, color: '#277da1', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase' }}>{t.pp_eyebrow}</div>
        <div className="fs-display a-fade-up" style={{ textAlign: 'center', animationDelay: '0.15s', fontSize: 28, lineHeight: 1.12, letterSpacing: '-0.03em', fontWeight: 800, color: '#2a0645', marginTop: 8, marginBottom: 14 }}>{t.pp_title}</div>
        <div className="no-sb" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {users.map((usr, i) => (
            <div key={usr.author} dir="auto" className="a-slide-up-far" style={{ padding: '12px 16px', background: 'rgba(42,6,69,0.06)', borderRadius: 14, animationDelay: `${0.4 + i * 0.08}s` }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <div className="fs-sans" style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: 700, color: '#2a0645', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{usr.author}</div>
                <div className="fs-display" style={{ fontSize: 18, fontWeight: 800, color: '#277da1' }}>{usr.messageCount.toLocaleString()}</div>
                <div className="fs-mono" style={{ fontSize: 12, color: 'rgba(42,6,69,0.55)', width: 46, textAlign: 'right' }}>{usr.sharePct.toFixed(1)}%</div>
              </div>
              <div className="fs-mono" style={{ marginTop: 4, fontSize: 11, color: 'rgba(42,6,69,0.6)' }}>
                {interp(t.pp_row, { words: usr.wordCount.toLocaleString(), avg: usr.avgWordsPerMsg.toFixed(1) })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </SlideShell>
  );
})

// 4) Signature words — one meaningful word per person (stopwords already excluded)
const SlideSignatureWords = React.memo(function SlideSignatureWords({ a, t }) {
  const rows = (a.users || []).filter(usr => usr.topWord);
  if (rows.length === 0) return null;
  return (
    <SlideShell bg="#577590" accent="#8338ec">
      <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', padding: '32px 22px 22px' }}>
        <div className="fs-sans a-fade-up" style={{ textAlign: 'center', fontSize: 12, color: '#8338ec', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase' }}>{t.sw_eyebrow}</div>
        <div className="fs-display a-fade-up" style={{ textAlign: 'center', animationDelay: '0.15s', fontSize: 30, lineHeight: 1.12, letterSpacing: '-0.03em', fontWeight: 800, color: '#2a0645', marginTop: 8, marginBottom: 16 }}>{t.sw_title}</div>
        <div className="no-sb" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map((usr, i) => (
            <div key={usr.author} dir="auto" className="a-slide-up-far" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'rgba(131,56,236,0.07)', borderRadius: 16, animationDelay: `${0.4 + i * 0.1}s` }}>
              <div className="fs-sans" style={{ width: '34%', flexShrink: 0, fontSize: 14, fontWeight: 600, color: 'rgba(42,6,69,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{usr.author}</div>
              <div className="fs-display" style={{ flex: 1, minWidth: 0, fontSize: usr.topWord.length > 10 ? 18 : 24, fontStyle: 'italic', fontWeight: 700, color: '#8338ec', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>"{usr.topWord}"</div>
              <div className="fs-mono" style={{ flexShrink: 0, fontSize: 12, color: 'rgba(42,6,69,0.5)' }}>{usr.topWordCount}×</div>
            </div>
          ))}
        </div>
      </div>
    </SlideShell>
  );
})

// 5) Group top — most-used emoji + most-used meaningful word
const SlideGroupTop = React.memo(function SlideGroupTop({ a, t }) {
  const word = (a.topWordsGroup && a.topWordsGroup[0]) || null;
  const emoji = (a.topEmojisGroup && a.topEmojisGroup[0]) || null;
  if (!word && !emoji) return null;
  return (
    <SlideShell bg="#f9c74f" accent="#f9c74f">
      <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center', padding: '0 24px', gap: 8 }}>
        <div className="fs-sans a-fade-up" style={{ fontSize: 12, color: '#f3722c', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase' }}>{t.gt_eyebrow}</div>
        {emoji && (
          <div className="a-spring" style={{ animationDelay: '0.2s', marginTop: 16 }}>
            <div style={{ fontSize: 84, lineHeight: 1 }}>{emoji.emoji}</div>
            <div className="fs-mono" style={{ marginTop: 4, fontSize: 13, color: 'rgba(42,6,69,0.6)' }}>{interp(t.gt_emoji, { n: emoji.count.toLocaleString() })}</div>
          </div>
        )}
        {word && (
          <div className="a-fade-up" style={{ animationDelay: '0.7s', marginTop: 24 }}>
            <div className="fs-display" dir="auto" style={{ fontSize: word.word.length > 10 ? 34 : 46, fontStyle: 'italic', fontWeight: 800, color: '#2a0645', letterSpacing: '-0.03em', lineHeight: 1.05, wordBreak: 'break-word' }}>"{word.word}"</div>
            <div className="fs-mono" style={{ marginTop: 8, fontSize: 13, color: 'rgba(42,6,69,0.6)' }}>{interp(t.gt_word, { n: word.count.toLocaleString() })}</div>
          </div>
        )}
      </div>
    </SlideShell>
  );
})

// Photos — real images extracted on-device from the "with media" .zip
const SlidePhotos = React.memo(function SlidePhotos({ a, t }) {
  const photos = a.photos || [];
  if (photos.length === 0) return null;
  const shown = photos.slice(0, 9);
  const tilts = [-3, 2, -2, 3, -1, 2, -3, 1, -2];
  return (
    <SlideShell bg="#f3722c" accent="#FF8C00">
      <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', padding: '32px 22px 22px' }}>
        <div className="fs-sans a-fade-up" style={{ textAlign: 'center', fontSize: 12, color: '#FF8C00', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase' }}>
          {t.photos_eyebrow}
        </div>
        <div className="fs-display a-fade-up" style={{ textAlign: 'center', animationDelay: '0.15s', fontSize: 30, lineHeight: 1.12, letterSpacing: '-0.03em', fontWeight: 800, color: '#2a0645', marginTop: 8, marginBottom: 4 }}>
          {interp(t.photos_title, { n: photos.length.toLocaleString() })}
        </div>
        <div className="fs-mono a-fade-up" style={{ textAlign: 'center', animationDelay: '0.2s', fontSize: 11, color: 'rgba(42,6,69,0.5)', marginBottom: 14 }}>
          {t.photos_sub}
        </div>
        <div className="no-sb" style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {shown.map((p, i) => (
              <div key={p.url} className="a-spring" style={{
                aspectRatio: '1 / 1', borderRadius: 12, overflow: 'hidden',
                background: '#fff', padding: 3, transform: `rotate(${tilts[i % tilts.length]}deg)`,
                boxShadow: '0 6px 14px -4px rgba(74,14,78,0.4)', animationDelay: `${0.3 + i * 0.07}s`,
              }}>
                <img src={p.url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 9, display: 'block' }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </SlideShell>
  );
})

// 9) Teaser — locked cards that make users want more (Step 4 hook)
const SlideTeaser = React.memo(function SlideTeaser({ t, onMenu, onExit }) {
  const cards = [
    { icon: '🔥', label: t.tz_roast },
    { icon: '👯', label: t.tz_duo },
    { icon: '👤', label: t.tz_profile },
    { icon: '🌪️', label: t.tz_chaos },
  ];
  return (
    <SlideShell bg="#577590" accent="#f94144">
      <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', padding: '32px 22px 22px' }}>
        <div className="fs-sans a-fade-up" style={{ textAlign: 'center', fontSize: 12, color: '#f94144', letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase' }}>{t.tz_eyebrow}</div>
        <div className="fs-display a-fade-up" style={{ textAlign: 'center', animationDelay: '0.15s', fontSize: 30, lineHeight: 1.12, letterSpacing: '-0.03em', fontWeight: 800, color: '#2a0645', marginTop: 8, marginBottom: 16 }}>{t.tz_title}</div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {cards.map((c, i) => (
            <div key={i} className="a-slide-up-far" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', background: 'rgba(42,6,69,0.06)', borderRadius: 16, animationDelay: `${0.4 + i * 0.12}s` }}>
              <div style={{ fontSize: 24, flexShrink: 0 }}>{c.icon}</div>
              <div className="fs-sans" dir="auto" style={{ flex: 1, fontSize: 16, fontWeight: 700, color: '#2a0645' }}>{c.label}</div>
              <div style={{ flexShrink: 0, fontSize: 16, opacity: 0.55 }}>🔒</div>
            </div>
          ))}
        </div>
        <button onClick={onMenu || onExit} className="press fs-sans" style={{ marginTop: 16, padding: '15px', background: '#f94144', color: '#fff', border: 'none', borderRadius: 999, fontSize: 17, fontWeight: 800, cursor: 'pointer', width: '100%' }}>
          {t.tz_cta}
        </button>
      </div>
    </SlideShell>
  );
})

const SLIDE_COMPONENTS = {
  intro:           SlideIntro,
  group_overview:  SlideGroupOverview,
  leaderboard:     SlideLeaderboard,
  per_person:      SlidePerPerson,
  signature_words: SlideSignatureWords,
  group_top:       SlideGroupTop,
  photos:          SlidePhotos,
  teaser:          SlideTeaser,
  message_count:   SlideMessageCount,
  rank:            SlideRank,
  vs_everyone:     SlideVsEveryone,
  novelist:        SlideNovelist,
  title:           SlideTitle,
  group_describes: SlideGroupDescribes,
  peak_hour:       SlidePeakHour,
  night:           SlideNight,
  streak:          SlideStreak,
  speed:           SlideSpeed,
  ghoster:         SlideGhoster,
  signature_word:  SlideWord,
  top_words:       SlideTopWords,
  top_emoji:       SlideEmoji,
  vibe_check:      SlideVibeCheck,
  drama_role:      SlideDramaRole,
  roast:           SlideRoast,
  achievements:    SlideAchievements,
  most_likely:     SlideMostLikely,
  duo:             SlideDuo,
  eras:            SlideEras,
  chaos_moment:    SlideChaosMoment,
  group_persona:   SlideGroupPersona,
  awards:          SlideAwards,
  peak_day:        SlidePeakDay,
  finale:          SlideFinale,
};
