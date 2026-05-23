import { useState } from 'react';
import { interp, resolveTitle } from '../i18n';
import BottomSheet from '../components/BottomSheet.jsx';

export default function RoastMode({ analytics, selectedAuthor, setSelectedAuthor, t, onBack }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const u = analytics.userMap[selectedAuthor];
  if (!u) return null;

  return (
    <div className="no-sb" style={{
      height: '100%', overflowY: 'auto', position: 'relative',
      background: 'radial-gradient(ellipse at top right, #2a0a1a 0%, #0a0a0f 60%)',
    }}>
      <div style={{ position: 'relative', padding: '14px 18px 28px', zIndex: 1 }}>

        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14,
        }}>
          <button onClick={onBack} className="press" style={{
            background: 'rgba(42,6,69,0.05)', border: '1px solid #2a2a36',
            color: '#cfcfdc', padding: '10px 16px', borderRadius: 999,
            fontSize: 22, fontWeight: 600, cursor: 'pointer', minHeight: 44,
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>{t.rm_back}</button>
          <div className="fs-mono" style={{ fontSize: 20, color: '#f3722c', letterSpacing: '0.2em', fontWeight: 700 }}>
            {t.rm_title}
          </div>
        </div>

        {/* Title */}
        <div className="fs-display a-fade-up" style={{
          fontSize: 52, lineHeight: 0.9, letterSpacing: '-0.04em',
          marginTop: 4, marginBottom: 8,
        }}>
          {t.rm_pick}<br/>
          <span style={{ fontStyle: 'italic', color: '#f3722c' }}>{t.rm_victim}</span>
        </div>
        <div className="a-fade-up" style={{
          animationDelay: '0.1s',
          fontSize: 23, color: '#d0d0e0', lineHeight: 1.5, marginBottom: 18,
        }}>
          {t.rm_sub}
        </div>

        {/* Person picker pill */}
        <button onClick={() => setPickerOpen(true)} className="press lift a-pop-in" style={{
          width: '100%', position: 'relative', overflow: 'hidden',
          padding: '16px 18px', cursor: 'pointer',
          background: 'linear-gradient(135deg, #f3722c 0%, #f3722c 100%)',
          border: 'none', borderRadius: 18, color: '#fff',
          boxShadow: '0 14px 30px rgba(243,114,44,0.35)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          textAlign: 'left',
        }}>
          <div className="a-shine" style={{ position: 'absolute', inset: 0 }} />
          <div style={{ position: 'relative' }}>
            <div className="fs-mono" style={{
              fontSize: 20, opacity: 0.8, letterSpacing: '0.2em', fontWeight: 700,
            }}>
              {t.rm_now}
            </div>
            <div className="fs-display" style={{
              fontSize: 28, lineHeight: 1, letterSpacing: '-0.03em',
              marginTop: 4, fontStyle: 'italic',
            }}>
              {selectedAuthor}
            </div>
            <div className="fs-mono" style={{
              fontSize: 20, opacity: 0.85, marginTop: 4, letterSpacing: '0.05em',
            }}>
              {u.messageCount.toLocaleString()} {t.eras_msgs} · "{resolveTitle(u, t)}"
            </div>
          </div>
          <div style={{ position: 'relative', fontSize: 22 }}>↕</div>
        </button>

        {/* Roast cards */}
        <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {u.roasts.map((roast, i) => (
            <div key={`${selectedAuthor}-${i}`} className="a-roast-card lift" style={{
              position: 'relative', overflow: 'hidden',
              padding: '20px 20px 18px',
              background: i % 2 === 0
                ? 'linear-gradient(135deg, rgba(243,114,44,0.16) 0%, rgba(243,114,44,0.04) 100%)'
                : 'linear-gradient(135deg, rgba(243,114,44,0.14) 0%, rgba(243,114,44,0.03) 100%)',
              border: `1px solid ${i % 2 === 0 ? 'rgba(243,114,44,0.4)' : 'rgba(243,114,44,0.35)'}`,
              borderRadius: 20,
              animationDelay: `${0.1 + i * 0.12}s`,
              boxShadow: i % 2 === 0
                ? '0 10px 28px rgba(243,114,44,0.12)'
                : '0 10px 28px rgba(243,114,44,0.10)',
            }}>
              <div style={{
                position: 'absolute', top: 14, right: 14,
                fontSize: 22, opacity: 0.5,
              }}>{i === 0 ? '🔥' : i === 1 ? '💀' : i === 2 ? '☠️' : '🫠'}</div>
              <div className="fs-mono" style={{
                fontSize: 20, color: i % 2 === 0 ? '#f3722c' : '#f3722c',
                letterSpacing: '0.22em', opacity: 0.75, marginBottom: 10, fontWeight: 700,
              }}>
                {t.rm_roast} #{String(i + 1).padStart(2, '0')}
              </div>
              <div className="fs-display" style={{
                fontSize: 22, lineHeight: 1.2, letterSpacing: '-0.01em',
                color: '#fff', fontWeight: 400,
              }}>
                {interp(t[roast.lineKey] || '', roast.vars || {})}
              </div>
              <div className="fs-display" style={{
                marginTop: 10, fontSize: 18, lineHeight: 1.3, letterSpacing: '-0.005em',
                color: i % 2 === 0 ? '#f3722c' : '#f3722c', fontStyle: 'italic',
              }}>
                {interp(t[roast.kickerKey] || '', roast.vars || {})}
              </div>
            </div>
          ))}
        </div>

        {/* Footer CTA */}
        <div style={{
          marginTop: 24, padding: '16px 18px',
          background: '#15151d', border: '1px solid #2a2a36',
          borderRadius: 16, textAlign: 'center',
        }}>
          <div className="fs-mono" style={{
            fontSize: 20, color: '#c8c8dc', letterSpacing: '0.2em', marginBottom: 6,
          }}>
            {t.rm_hot_take}
          </div>
          <div className="fs-display" style={{
            fontSize: 18, lineHeight: 1.3, letterSpacing: '-0.01em', fontStyle: 'italic',
            whiteSpace: 'pre-line',
          }}>
            {interp(t.rm_screenshot, { name: selectedAuthor }).split(selectedAuthor).reduce((acc, part, idx, arr) => {
              acc.push(part);
              if (idx < arr.length - 1) {
                acc.push(<span key={idx} style={{ color: '#f3722c' }}>{selectedAuthor}</span>);
              }
              return acc;
            }, [])}
          </div>
        </div>

        {/* Other victims */}
        <div style={{ marginTop: 24 }}>
          <div className="fs-mono" style={{
            fontSize: 20, color: '#c8c8dc', letterSpacing: '0.2em', marginBottom: 10,
          }}>
            {t.rm_others}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {analytics.users.filter(x => x.author !== selectedAuthor).map((other, i) => (
              <button key={other.author} onClick={() => setSelectedAuthor(other.author)}
                className="press lift" style={{
                  width: '100%', textAlign: 'left',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '12px 14px',
                  background: '#15151d', border: '1px solid #2a2a36',
                  borderRadius: 12, cursor: 'pointer', color: '#f4f4f8',
                  animation: `fadeUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${0.3 + i * 0.05}s both`,
                }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 22, fontWeight: 700,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {other.author}
                  </div>
                  <div className="fs-mono" style={{
                    fontSize: 20, color: '#f3722c', marginTop: 2, fontStyle: 'italic',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {interp(other.roasts.length === 1 ? t.rm_ready : t.rm_ready_plural, { n: other.roasts.length })}
                  </div>
                </div>
                <div className="fs-mono" style={{ fontSize: 20, color: '#f9c74f', letterSpacing: '0.1em' }}>
                  {t.rm_btn}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {pickerOpen && (
        <BottomSheet onClose={() => setPickerOpen(false)} title={t.rm_switch_person}>
          {analytics.users.map(user => (
            <button key={user.author} className="press" onClick={() => {
              setSelectedAuthor(user.author);
              setPickerOpen(false);
            }} style={{
              width: '100%', padding: '16px 8px', minHeight: 56, background: 'transparent',
              border: 'none', borderBottom: '1px solid #2a2a36', color: '#f4f4f8',
              fontSize: 23, fontWeight: 500, textAlign: 'left', cursor: 'pointer',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{
                  fontSize: 22, fontWeight: 600,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{user.author}</div>
                <div className="fs-mono" style={{
                  fontSize: 20, color: '#f3722c', marginTop: 2, fontStyle: 'italic',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{interp(user.roasts.length === 1 ? t.rm_ready : t.rm_ready_plural, { n: user.roasts.length })}</div>
              </div>
              <span className="fs-mono" style={{
                fontSize: 20, color: '#c8c8dc', flexShrink: 0, marginLeft: 8,
              }}>
                {user.messageCount.toLocaleString()}
              </span>
            </button>
          ))}
        </BottomSheet>
      )}
    </div>
  );
}
