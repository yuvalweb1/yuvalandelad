import { useState } from 'react';
import { interp, resolveTitle } from '../i18n';
import BottomSheet from '../components/BottomSheet.jsx';
import AdSlot from '../components/AdSlot.jsx';

export default function PostMenu({ analytics, diagnostics, selectedAuthor, setSelectedAuthor, t, onReplay, onReset, onDebug, onRoastMode }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const u = analytics.userMap[selectedAuthor];
  if (!u) return null;
  const rank = analytics.users.findIndex(x => x.author === selectedAuthor) + 1;
  const userAchievements = analytics.achievementsByUser[selectedAuthor] || [];

  return (
    <div className="no-sb" style={{
      height: '100%', overflowY: 'auto', position: 'relative',
      background: '#faf6f0',
    }}>
      {/* Background blobs */}
      <div style={{
        position: 'fixed', top: -50, right: -60, width: 200, height: 200,
        borderRadius: '50%', background: '#ffd972', opacity: 0.50,
        filter: 'blur(65px)', pointerEvents: 'none', zIndex: 0,
      }} />
      <div style={{
        position: 'fixed', bottom: 80, left: -50, width: 180, height: 180,
        borderRadius: '50%', background: '#9cf6f6', opacity: 0.45,
        filter: 'blur(60px)', pointerEvents: 'none', zIndex: 0,
      }} />
      <div style={{
        position: 'fixed', top: '40%', left: -70, width: 160, height: 160,
        borderRadius: '50%', background: '#f1e4f3', opacity: 0.70,
        filter: 'blur(55px)', pointerEvents: 'none', zIndex: 0,
      }} />

      <div style={{ padding: '16px 20px 32px', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em', color: '#2a0645' }}>
            chat<span style={{ color: '#f06449' }}>wrapped</span>
          </div>
          <button onClick={onReset} className="press" aria-label={t.a11y_start_over || 'Start over'} style={{
            background: 'rgba(87,50,128,0.08)', border: '1px solid rgba(87,50,128,0.18)', color: '#573280',
            width: 40, height: 40, borderRadius: 999, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <polyline points="23 4 23 10 17 10"/>
              <polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
          </button>
        </div>

        <div style={{ height: 14 }} />

        {/* CTAs: Replay + Roast Mode side by side */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onReplay} className="a-scale-in press lift" style={{
            flex: 1, position: 'relative', overflow: 'hidden', textAlign: 'left',
            background: 'linear-gradient(135deg, #ffd972 0%, #f9c74f 100%)',
            border: 'none', borderRadius: 18, padding: '16px 14px', cursor: 'pointer',
            color: '#2a0645', boxShadow: '0 8px 24px rgba(255,217,114,0.50)',
          }}>
            <div className="a-shine" style={{ position: 'absolute', inset: 0 }} />
            <div className="fs-display" style={{
              position: 'absolute', right: -14, top: -10, fontSize: 80,
              opacity: 0.15, lineHeight: 1,
            }}>✦</div>
            <div className="fs-mono" style={{
              fontSize: 10, letterSpacing: '0.22em', opacity: 0.70, fontWeight: 700,
            }}>
              {t.menu_replay}
            </div>
            <div className="fs-display" style={{
              fontSize: 21, lineHeight: 1.0, letterSpacing: '-0.03em', marginTop: 4,
              whiteSpace: 'pre-line', fontWeight: 800,
            }}>
              {t.menu_watch}
            </div>
          </button>

          <button onClick={onRoastMode} className="a-scale-in press lift" style={{
            flex: 1, position: 'relative', overflow: 'hidden', textAlign: 'left',
            background: 'linear-gradient(135deg, #f06449 0%, #e8533a 100%)',
            border: 'none', borderRadius: 18, padding: '16px 14px', cursor: 'pointer',
            color: '#fff', boxShadow: '0 8px 24px rgba(240,100,73,0.40)',
            animationDelay: '0.05s',
          }}>
            <div className="a-shine" style={{ position: 'absolute', inset: 0 }} />
            <div style={{
              position: 'absolute', right: -8, top: -8, fontSize: 60,
              opacity: 0.20, lineHeight: 1,
            }}>🔥</div>
            <div className="fs-mono" style={{
              fontSize: 10, letterSpacing: '0.22em', opacity: 0.90, fontWeight: 700,
            }}>
              {t.menu_roast_mode}
            </div>
            <div className="fs-display" style={{
              fontSize: 21, lineHeight: 1.0, letterSpacing: '-0.03em', marginTop: 4,
              whiteSpace: 'pre-line', fontWeight: 800,
            }}>
              {t.menu_roast_everyone}
            </div>
          </button>
        </div>

        {/* Ad banner slot (placeholder until filled — see src/lib/ads.js) */}
        <AdSlot slot="menu" format="banner" t={t} style={{ marginTop: 10 }} />

        {/* Person picker */}
        <button onClick={() => setPickerOpen(true)} className="press" style={{
          width: '100%', marginTop: 10,
          padding: '13px 16px',
          background: 'rgba(241,228,243,0.60)', border: '1px solid rgba(87,50,128,0.15)',
          borderRadius: 16, cursor: 'pointer',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          boxShadow: '0 2px 10px rgba(87,50,128,0.06)',
        }}>
          <div style={{ textAlign: 'left' }}>
            <div className="fs-mono" style={{ fontSize: 10, color: 'rgba(42,6,69,0.50)', letterSpacing: '0.18em', textTransform: 'uppercase' }}>
              {t.menu_viewing_as}
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, marginTop: 3, color: '#2a0645' }}>{selectedAuthor}</div>
            <div className="fs-mono" style={{
              fontSize: 11, color: '#573280', marginTop: 3, fontStyle: 'italic',
            }}>"{resolveTitle(u, t)}"</div>
          </div>
          <div className="fs-mono" style={{ fontSize: 12, color: '#f06449', letterSpacing: '0.1em', fontWeight: 700 }}>
            {t.menu_switch}
          </div>
        </button>

        {/* Verified data badge */}
        <button onClick={onDebug} className="press" style={{
          width: '100%', textAlign: 'left',
          marginTop: 10, padding: '13px 16px',
          background: 'rgba(255,217,114,0.20)',
          border: '1px solid rgba(255,217,114,0.45)',
          borderRadius: 14, cursor: 'pointer', color: '#2a0645',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          minHeight: 52, boxShadow: '0 2px 10px rgba(255,217,114,0.15)',
        }}>
          <div>
            <div className="fs-mono" style={{
              fontSize: 11, color: '#573280', letterSpacing: '0.2em', fontWeight: 700,
            }}>
              {interp(t.menu_verified, { n: diagnostics?.confidence ?? 0 })}
            </div>
            <div style={{ fontSize: 13, color: 'rgba(42,6,69,0.70)', marginTop: 4 }}>
              {interp(t.menu_msgs_senders, {
                msgs: diagnostics?.parsedMessages.toLocaleString(),
                senders: Object.keys(diagnostics?.perAuthorCount || {}).length,
              })}
            </div>
            {diagnostics?.warnings.length > 0 && (
              <div style={{ fontSize: 11, color: '#f06449', marginTop: 3 }}>
                {diagnostics.warnings[0]}
              </div>
            )}
          </div>
          <div className="fs-mono" style={{ fontSize: 11, color: 'rgba(42,6,69,0.40)', letterSpacing: '0.1em', fontWeight: 600 }}>
            {t.menu_verify}
          </div>
        </button>

        {/* Group personality */}
        <div style={{
          marginTop: 14, padding: 16,
          background: 'rgba(87,50,128,0.07)',
          border: '1px solid rgba(87,50,128,0.14)', borderRadius: 16,
          boxShadow: '0 2px 12px rgba(87,50,128,0.06)',
        }}>
          <div className="fs-mono" style={{
            fontSize: 10, color: '#f06449', letterSpacing: '0.2em', marginBottom: 6,
            fontWeight: 700, textTransform: 'uppercase',
          }}>
            ✦ {t.menu_this_group_is}
          </div>
          <div className="fs-display" style={{
            fontSize: 22, lineHeight: 1.05, letterSpacing: '-0.03em',
            fontStyle: 'italic', color: '#573280', fontWeight: 800,
          }}>
            {analytics.groupPersonality}
          </div>
          <div style={{ fontSize: 13, color: 'rgba(42,6,69,0.65)', marginTop: 8, lineHeight: 1.5 }}>
            {analytics.groupPersonalityReason}
          </div>
        </div>

        {/* Eras */}
        {analytics.eras && analytics.eras.length >= 2 && (
          <div style={{ marginTop: 20 }}>
            <div className="fs-mono" style={{
              fontSize: 10, color: 'rgba(42,6,69,0.45)', letterSpacing: '0.2em', marginBottom: 8,
              fontWeight: 700, textTransform: 'uppercase',
            }}>
              {t.menu_eras}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {analytics.eras.map((era, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '11px 14px',
                  background: i === 0 ? 'rgba(255,217,114,0.22)' : 'rgba(241,228,243,0.50)',
                  border: '1px solid rgba(87,50,128,0.10)',
                  borderRadius: 14,
                  boxShadow: '0 1px 6px rgba(87,50,128,0.05)',
                }}>
                  <div className="fs-mono" style={{
                    fontSize: 13, color: i === 0 ? '#f06449' : 'rgba(87,50,128,0.50)', fontWeight: 700, width: 22,
                  }}>
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="fs-display" style={{
                      fontSize: 15, fontStyle: 'italic', letterSpacing: '-0.01em',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      color: '#2a0645', fontWeight: 700,
                    }}>
                      {era.name}
                    </div>
                    <div className="fs-mono" style={{ fontSize: 11, color: 'rgba(42,6,69,0.50)', marginTop: 1 }}>
                      {era.messageCount.toLocaleString()} {t.eras_msgs} · {era.days}d
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Highlights */}
        <div style={{ marginTop: 20 }}>
          <div className="fs-mono" style={{
            fontSize: 10, color: 'rgba(42,6,69,0.45)', letterSpacing: '0.2em', marginBottom: 8,
            fontWeight: 700, textTransform: 'uppercase',
          }}>
            {t.menu_highlights}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
            <HighlightCard value={u.messageCount.toLocaleString()} label={t.menu_hl_messages} accent />
            <HighlightCard value={`#${rank}`} label={interp(t.menu_hl_of, { n: analytics.users.length })} />
            <HighlightCard value={`${u.peakHour}:00`} label={t.menu_hl_peak_hour} />
            <HighlightCard value={`${Math.round(u.nightPct)}%`} label={t.menu_hl_at_night} />
            <HighlightCard value={`${u.longestStreak}d`} label={t.menu_hl_streak} />
            <HighlightCard value={u.topEmoji || '—'} label={t.menu_hl_top_emoji} />
            <HighlightCard value={u.topWord || '—'} label={t.menu_hl_top_word} small />
            <HighlightCard
              value={u.avgRespMin != null
                ? (u.avgRespMin < 60 ? `${u.avgRespMin.toFixed(1)}m` : `${(u.avgRespMin/60).toFixed(1)}h`)
                : '—'}
              label={t.menu_hl_avg_reply} />
          </div>
        </div>

        {/* Achievements */}
        {userAchievements.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <div className="fs-mono" style={{
              fontSize: 10, color: 'rgba(42,6,69,0.45)', letterSpacing: '0.2em', marginBottom: 8,
              fontWeight: 700, textTransform: 'uppercase',
            }}>
              {t.menu_badges} · {userAchievements.length}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {userAchievements.map((ach, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 13px',
                  background: `${ach.color}18`,
                  border: `1px solid ${ach.color}30`,
                  borderRadius: 13,
                }}>
                  <div style={{ fontSize: 16 }}>🏆</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: ach.color }}>{t[ach.labelKey] || ach.labelKey}</div>
                    <div className="fs-mono" style={{ fontSize: 11, color: 'rgba(42,6,69,0.50)', marginTop: 1 }}>{interp(t[ach.evidenceKey] || '', ach.vars || {})}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Leaderboard */}
        <div style={{ marginTop: 20 }}>
          <div className="fs-mono" style={{
            fontSize: 10, color: 'rgba(42,6,69,0.45)', letterSpacing: '0.2em', marginBottom: 8,
            fontWeight: 700, textTransform: 'uppercase',
          }}>
            {t.menu_leaderboard}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {analytics.users.map((user, i) => {
              const isUser = user.author === selectedAuthor;
              const isFirst = i === 0;
              return (
                <div key={user.author} dir="auto" style={{
                  padding: '12px 14px',
                  background: isFirst ? 'rgba(255,217,114,0.28)' : isUser ? 'rgba(241,228,243,0.60)' : 'rgba(241,228,243,0.35)',
                  border: `1px solid ${isFirst ? 'rgba(255,217,114,0.40)' : 'rgba(87,50,128,0.10)'}`,
                  borderRadius: 16,
                  boxShadow: '0 1px 6px rgba(87,50,128,0.05)',
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                      <div className="fs-mono" style={{
                        fontSize: 12, color: isFirst ? '#f06449' : 'rgba(87,50,128,0.35)', width: 18, fontWeight: 700,
                      }}>
                        {String(i + 1).padStart(2, '0')}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{
                          fontSize: 14, fontWeight: isUser || isFirst ? 700 : 500,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          color: '#2a0645',
                        }}>
                          {user.author}{isUser && <span style={{ color: '#f06449', fontSize: 11 }}> {t.rank_you}</span>}
                        </div>
                        <div className="fs-mono" style={{
                          fontSize: 11, color: 'rgba(42,6,69,0.45)', marginTop: 1, fontStyle: 'italic',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {resolveTitle(user, t)}
                        </div>
                      </div>
                    </div>
                    <div className="fs-mono" style={{
                      fontSize: 13, color: isFirst ? '#f06449' : 'rgba(42,6,69,0.60)',
                      fontWeight: 600, flexShrink: 0,
                    }}>
                      {user.messageCount.toLocaleString()}
                    </div>
                  </div>
                </div>
              );
            })}
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
                  fontSize: 20, color: '#f9c74f', marginTop: 2, fontStyle: 'italic',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>"{resolveTitle(user, t)}"</div>
              </div>
              <span className="fs-mono" style={{ fontSize: 20, color: '#c8c8dc', flexShrink: 0, marginLeft: 8 }}>
                {user.messageCount.toLocaleString()}
              </span>
            </button>
          ))}
        </BottomSheet>
      )}
    </div>
  );
}

function HighlightCard({ value, label, accent, small }) {
  return (
    <div style={{
      background: accent ? 'rgba(255,217,114,0.22)' : 'rgba(241,228,243,0.50)',
      border: `1px solid ${accent ? 'rgba(255,217,114,0.40)' : 'rgba(87,50,128,0.10)'}`,
      borderRadius: 14, padding: 13, minHeight: 80,
      boxShadow: '0 1px 6px rgba(87,50,128,0.05)',
    }}>
      <div className="fs-display" style={{
        fontSize: small ? 16 : 24, letterSpacing: '-0.02em', lineHeight: 1,
        color: accent ? '#f06449' : '#2a0645',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        fontWeight: 800,
      }}>{value}</div>
      <div className="fs-mono" style={{
        fontSize: 10, color: 'rgba(42,6,69,0.45)', letterSpacing: '0.12em', marginTop: 7,
        textTransform: 'uppercase',
      }}>{label}</div>
    </div>
  );
}
