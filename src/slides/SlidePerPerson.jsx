import React, { useState, useEffect } from 'react';
import SlideShell from './SlideShell.jsx';
import ListSlideDecor from '../components/ListSlideDecor.jsx';
import { typedCopy } from '../i18n';

const MAX_ROWS = 4;
const ACCENT = '#277da1';

function verbosityLabel(avg, t) {
  if (avg >= 40) return t.pp_label_essayist || 'Essayist';
  if (avg >= 20) return t.pp_label_verbose  || 'Verbose';
  if (avg >= 10) return t.pp_label_chatty   || 'Chatty';
  if (avg >= 4)  return t.pp_label_brief    || 'Brief';
  return t.pp_label_minimal || 'Minimal';
}

function verbosityColor(avg) {
  if (avg >= 40) return '#8338ec';
  if (avg >= 20) return '#e05c8a';
  if (avg >= 10) return '#277da1';
  if (avg >= 4)  return '#43aa8b';
  return '#90be6d';
}

const SlidePerPerson = React.memo(function SlidePerPerson({ a, t, profile }) {
  const type = profile?.relationship || 'other';
  const allUsers = a.users || [];
  if (allUsers.length === 0) return null;

  const [expanded, setExpanded] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(id);
  }, []);

  const sorted = [...allUsers].sort((a, b) => b.avgWordsPerMsg - a.avgWordsPerMsg);
  const overflow = sorted.length - MAX_ROWS;
  const showOverflow = overflow > 0 && !expanded;
  const users = showOverflow ? sorted.slice(0, MAX_ROWS) : sorted;
  const maxAvg = sorted[0]?.avgWordsPerMsg || 1;
  const moreLabel = (t.lb_more || '+{n} more').replace('{n}', overflow);

  return (
    <SlideShell bg="#577590" accent={ACCENT}>
      <ListSlideDecor emojis={['✍️', '📝', '💬', '🗣️', '📖', '✨']} />
      <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column', padding: '28px 20px 22px' }}>

        <div className="fs-sans a-fade-up" style={{
          textAlign: 'center', fontSize: 12, color: ACCENT,
          letterSpacing: '0.18em', fontWeight: 800, textTransform: 'uppercase',
        }}>
          ✍️ {typedCopy(t, 'pp_eyebrow', type)}
        </div>

        <div className="fs-display a-fade-up" dir="auto" style={{
          textAlign: 'center', animationDelay: '0.15s',
          fontSize: 32, lineHeight: 1.1, letterSpacing: '-0.04em',
          fontWeight: 800, color: '#4A0E4E',
          marginTop: 8, marginBottom: 16,
          textShadow: '0 2px 0 rgba(255,255,255,0.65)',
          padding: '0 8px',
        }}>
          {typedCopy(t, 'pp_title', type)}
        </div>

        <div className="no-sb" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 9 }}>
          {users.map((usr, i) => {
            const barPct = (usr.avgWordsPerMsg / maxAvg) * 100;
            const color = verbosityColor(usr.avgWordsPerMsg);
            const label = verbosityLabel(usr.avgWordsPerMsg, t);
            const numStr = usr.avgWordsPerMsg.toFixed(1);
            const cardDelay = 0.3 + i * 0.08;

            return (
              <div key={usr.author} dir="auto" className="a-slide-up-far" style={{
                padding: '13px 16px 11px',
                background: '#fff',
                borderRadius: 20,
                border: '2px solid rgba(255,255,255,0.85)',
                boxShadow: `0 6px 0 ${ACCENT}22, 0 14px 24px -8px ${ACCENT}55`,
                flexShrink: 0,
                animationDelay: `${cardDelay}s`,
              }}>

                {/* dir=ltr keeps the number physically on the left and the name on
                    the right regardless of the name's script; the name span keeps
                    dir=auto so Hebrew/Arabic still renders correctly. */}
                <div dir="ltr" style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  {/* Left: the average number */}
                  <div style={{ flexShrink: 0 }}>
                    <div className="fs-display" style={{
                      fontSize: numStr.length > 4 ? 28 : 34,
                      fontWeight: 900, color,
                      letterSpacing: '-0.04em', lineHeight: 1,
                    }}>
                      {numStr}
                    </div>
                    <div className="fs-mono" style={{
                      marginTop: 2,
                      fontSize: 9, color: 'rgba(74,14,78,0.4)',
                      letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700,
                    }}>
                      {t.pp_words_per_msg || 'words per message'}
                    </div>
                  </div>

                  {/* Right: name + verbosity label */}
                  <div style={{ flex: 1, minWidth: 0, textAlign: 'right' }}>
                    <div dir="auto" className="fs-sans" style={{
                      fontSize: 15, fontWeight: 800, color: '#4A0E4E',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {usr.author}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                      <span className="fs-mono" style={{
                        fontSize: 9, fontWeight: 800, letterSpacing: '0.1em',
                        textTransform: 'uppercase', color,
                        background: `${color}18`, borderRadius: 99,
                        padding: '2px 7px',
                      }}>
                        {label}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 9, height: 5, borderRadius: 99, background: 'rgba(74,14,78,0.07)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 99,
                    width: mounted ? `${barPct}%` : '0%',
                    background: `linear-gradient(90deg, ${color}88, ${color})`,
                    transition: `width 0.9s cubic-bezier(0.34, 1.56, 0.64, 1) ${cardDelay + 0.25}s`,
                  }} />
                </div>

              </div>
            );
          })}

          {showOverflow && (
            <button onClick={() => setExpanded(true)} className="press" style={{
              background: 'none', border: 'none', cursor: 'pointer',
              textAlign: 'center', fontSize: 11, color: ACCENT,
              fontWeight: 700, letterSpacing: '0.12em', padding: '6px 0', width: '100%',
            }}>
              {moreLabel} ↓
            </button>
          )}
        </div>
      </div>
    </SlideShell>
  );
});

export default SlidePerPerson;
