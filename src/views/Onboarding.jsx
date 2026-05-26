import { useState } from 'react';

// Take the first visible character of a name (skips spaces, handles emoji/RTL).
function nameInitial(name) {
  const trimmed = (name || '').trim();
  if (!trimmed) return '?';
  const first = Array.from(trimmed)[0];
  return first.toUpperCase();
}

export default function Onboarding({ analytics, t, profile, setProfile, onComplete, onSkip }) {
  const [step, setStep] = useState(0); // 0: who_are_you, 1: relationship, 2: tone
  const [draft, setDraft] = useState({
    self: profile.self || analytics.users[0]?.author || null,
    relationship: profile.relationship || null,
    tone: profile.tone || null,
  });

  const steps = [
    {
      key: 'self',
      question: t.q_who_are_you,
      hint: t.q_who_are_you_hint,
      type: 'people',
    },
    {
      key: 'relationship',
      question: t.q_relationship,
      type: 'choice',
      options: [
        { value: 'friends', label: t.q_relationship_friends, icon: '🍻' },
        { value: 'family', label: t.q_relationship_family, icon: '👨‍👩‍👧' },
        { value: 'work', label: t.q_relationship_work, icon: '💼' },
        { value: 'couple', label: t.q_relationship_couple, icon: '💕' },
        { value: 'other', label: t.q_relationship_other, icon: '✦' },
      ],
    },
    {
      key: 'tone',
      question: t.q_tone,
      type: 'tone',
      options: [
        { value: 'mild', label: t.q_tone_mild, desc: t.q_tone_mild_d, color: '#277da1', icon: '😊' },
        { value: 'medium', label: t.q_tone_medium, desc: t.q_tone_medium_d, color: '#d99412', icon: '😏' },
        { value: 'spicy', label: t.q_tone_spicy, desc: t.q_tone_spicy_d, color: '#f3722c', icon: '🔥' },
      ],
    },
  ];

  const currentStep = steps[step];
  const currentValue = draft[currentStep.key];
  const canContinue = currentValue !== null;
  const isLast = step === steps.length - 1;
  const isPeopleStep = currentStep.type === 'people';

  const handleNext = () => {
    if (isLast) {
      onComplete(draft);
    } else {
      setStep(step + 1);
    }
  };

  return (
    <div style={{
      position: 'relative', height: '100%',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      background: 'linear-gradient(180deg, #FFF6D6 0%, #FFF0E2 46%, #FDE6F1 100%)',
    }}>
      {/* Decorative gradient blobs — set the mood, match Landing's palette */}
      <div aria-hidden="true" style={{
        position: 'absolute', top: -80, right: -80, width: 260, height: 260,
        borderRadius: '50%', background: '#FFD700', opacity: 0.50, filter: 'blur(75px)',
        pointerEvents: 'none',
      }} />
      <div aria-hidden="true" style={{
        position: 'absolute', top: 140, left: -100, width: 230, height: 230,
        borderRadius: '50%', background: '#FF69B4', opacity: 0.30, filter: 'blur(72px)',
        pointerEvents: 'none',
      }} />
      <div aria-hidden="true" style={{
        position: 'absolute', bottom: -90, right: -60, width: 220, height: 220,
        borderRadius: '50%', background: '#FF8C00', opacity: 0.22, filter: 'blur(70px)',
        pointerEvents: 'none',
      }} />

      {/* Decorative floating chat bubbles — mirror Landing's motif */}
      <div aria-hidden="true" className="a-float" style={{
        position: 'absolute', top: '14%', left: '5%',
        width: 54, height: 36, background: '#fff',
        boxShadow: '0 8px 20px rgba(74,14,78,0.14)',
        borderRadius: '18px 18px 18px 4px',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
        pointerEvents: 'none', zIndex: 0,
      }}>
        {[0, 1, 2].map(d => (
          <span key={d} style={{ width: 5, height: 5, borderRadius: 999, background: '#FF69B4' }} />
        ))}
      </div>
      <div aria-hidden="true" className="a-float" style={{
        position: 'absolute', bottom: '10%', right: '6%',
        width: 42, height: 30, background: '#4A0E4E',
        boxShadow: '0 8px 18px rgba(74,14,78,0.22)',
        borderRadius: '16px 16px 4px 16px',
        animationDelay: '1.4s',
        pointerEvents: 'none', zIndex: 0,
      }} />

      {/* Content column — capped width; outer is flex column so children can claim a fixed
          share of the height while the body scrolls within itself. */}
      <div style={{
        position: 'relative', zIndex: 1, flex: 1,
        maxWidth: 520, width: '100%', margin: '0 auto',
        padding: '18px 22px 22px',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        minHeight: 0,
      }}>
        {/* Header: progress + skip (fixed) */}
        <div style={{
          flexShrink: 0,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24,
        }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {steps.map((_, i) => (
              <div key={i} style={{
                width: i === step ? 28 : 8, height: 4, borderRadius: 999,
                background: i <= step ? '#f06449' : 'rgba(74,14,78,0.15)',
                transition: 'width 0.35s, background 0.3s',
              }} />
            ))}
          </div>
          <button onClick={onSkip} className="fs-mono press" style={{
            background: 'transparent', border: 'none',
            color: '#573280', padding: '10px 8px', minHeight: 44,
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
            letterSpacing: '0.12em', textTransform: 'uppercase',
            opacity: 0.72,
          }}>
            {t.onboard_skip}
          </button>
        </div>

        {/* Title (fixed) */}
        <div className="a-fade-up" style={{ marginBottom: 4, flexShrink: 0 }}>
          <div className="fs-display" style={{
            fontSize: currentStep.question.length > 36 ? 26 : 32,
            lineHeight: 1.08, letterSpacing: '-0.03em', marginBottom: 6,
            fontWeight: 800, color: '#4A0E4E',
            overflowWrap: 'break-word', wordBreak: 'break-word', hyphens: 'auto',
          }}>
            {currentStep.question}
          </div>
          {currentStep.hint && (
            <div style={{
              fontSize: 14, color: '#573280', marginTop: 4, lineHeight: 1.4,
              opacity: 0.78,
            }}>
              {currentStep.hint}
            </div>
          )}
        </div>

        {/* Body — only the people list scrolls within itself; choice/tone stay fixed. */}
        <div key={step} style={{
          marginTop: 22,
          flex: 1, minHeight: 0,
          display: 'flex', flexDirection: 'column',
          justifyContent: isPeopleStep ? 'flex-start' : 'center',
        }}>
          {currentStep.type === 'people' && (
            <div className="no-sb" style={{
              overflowY: 'auto',
              flex: 1, minHeight: 0,
              display: 'flex', flexDirection: 'column', gap: 10,
              paddingBottom: 4,
            }}>
              {analytics.users.map((u, i) => {
                const selected = draft.self === u.author;
                const initial = nameInitial(u.author);
                const msgCount = u.messageCount || 0;
                return (
                  <button key={u.author} dir="auto" onClick={() => setDraft({ ...draft, self: u.author })}
                    className="press lift" style={{
                      width: '100%', textAlign: 'start',
                      padding: '14px 16px', cursor: 'pointer',
                      background: selected
                        ? 'linear-gradient(135deg, rgba(240,100,73,0.10), rgba(255,215,0,0.06))'
                        : '#ffffff',
                      border: `1px solid ${selected ? '#f06449' : 'rgba(74,14,78,0.10)'}`,
                      borderRadius: 16, color: '#4A0E4E',
                      display: 'flex', alignItems: 'center', gap: 14,
                      flexShrink: 0,
                      animation: `fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) ${Math.min(i, 8) * 0.04}s both`,
                      boxShadow: selected
                        ? '0 12px 28px rgba(240,100,73,0.22)'
                        : '0 4px 12px rgba(74,14,78,0.08)',
                      transition: 'background 0.2s, border-color 0.2s, box-shadow 0.2s',
                    }}>
                    {/* Avatar */}
                    <div style={{
                      width: 44, height: 44, borderRadius: '50%',
                      background: selected
                        ? 'linear-gradient(135deg, #f06449 0%, #FFD700 100%)'
                        : 'rgba(74,14,78,0.08)',
                      color: selected ? '#ffffff' : '#4A0E4E',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 18, fontWeight: 800, flexShrink: 0,
                      fontFamily: 'Bricolage Grotesque, DM Sans, sans-serif',
                      transition: 'background 0.2s, color 0.2s',
                    }}>
                      {initial}
                    </div>

                    {/* Name + meta */}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div dir="auto" style={{
                        fontSize: 17, fontWeight: selected ? 800 : 700,
                        lineHeight: 1.2,
                        color: '#4A0E4E',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {u.author}
                      </div>
                      {msgCount > 0 && (
                        <div className="fs-mono" style={{
                          fontSize: 12,
                          color: selected ? '#f06449' : 'rgba(74,14,78,0.55)',
                          marginTop: 3, letterSpacing: '0.02em',
                          fontWeight: 600,
                        }}>
                          {msgCount.toLocaleString()} {t.go_messages || 'messages'}
                        </div>
                      )}
                    </div>

                    {/* Checkmark */}
                    {selected && (
                      <div style={{
                        width: 24, height: 24, borderRadius: '50%', background: '#f06449',
                        color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                        animation: 'scaleSpring 0.32s cubic-bezier(0.16,1,0.3,1) both',
                      }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                          strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {currentStep.type === 'choice' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {currentStep.options.map((opt, i) => {
                const selected = draft[currentStep.key] === opt.value;
                return (
                  <button key={opt.value} dir="auto" onClick={() => setDraft({ ...draft, [currentStep.key]: opt.value })}
                    className="press lift" style={{
                      width: '100%', textAlign: 'start',
                      padding: '16px 18px', cursor: 'pointer',
                      background: selected
                        ? 'linear-gradient(135deg, rgba(240,100,73,0.10), rgba(255,215,0,0.06))'
                        : '#ffffff',
                      border: `1px solid ${selected ? '#f06449' : 'rgba(74,14,78,0.10)'}`,
                      borderRadius: 16, color: '#4A0E4E',
                      display: 'flex', alignItems: 'center', gap: 14,
                      animation: `fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) ${i * 0.05}s both`,
                      boxShadow: selected
                        ? '0 12px 28px rgba(240,100,73,0.22)'
                        : '0 4px 12px rgba(74,14,78,0.08)',
                      transition: 'background 0.2s, border-color 0.2s, box-shadow 0.2s',
                    }}>
                    <div style={{ fontSize: 26, lineHeight: 1, flexShrink: 0 }}>{opt.icon}</div>
                    <div style={{
                      flex: 1, fontSize: 16,
                      fontWeight: selected ? 800 : 700,
                      color: '#4A0E4E',
                    }}>
                      {opt.label}
                    </div>
                    {selected && (
                      <div style={{
                        width: 22, height: 22, borderRadius: '50%', background: '#f06449',
                        color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                        animation: 'scaleSpring 0.32s cubic-bezier(0.16,1,0.3,1) both',
                      }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                          strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {currentStep.type === 'tone' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {currentStep.options.map((opt, i) => {
                const selected = draft.tone === opt.value;
                return (
                  <button key={opt.value} dir="auto" onClick={() => setDraft({ ...draft, tone: opt.value })}
                    className="press lift" style={{
                      width: '100%', textAlign: 'start',
                      padding: '18px 20px', cursor: 'pointer',
                      background: selected
                        ? `linear-gradient(135deg, ${opt.color}22, ${opt.color}08)`
                        : '#ffffff',
                      border: `1px solid ${selected ? opt.color : 'rgba(74,14,78,0.10)'}`,
                      borderRadius: 18, color: '#4A0E4E',
                      display: 'flex', alignItems: 'center', gap: 14,
                      animation: `fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) ${i * 0.06}s both`,
                      boxShadow: selected
                        ? `0 12px 28px ${opt.color}40`
                        : '0 4px 12px rgba(74,14,78,0.08)',
                      transition: 'background 0.2s, border-color 0.2s, box-shadow 0.2s',
                    }}>
                    <div style={{ fontSize: 32, lineHeight: 1, flexShrink: 0 }}>{opt.icon}</div>
                    <div style={{ flex: 1 }}>
                      <div className="fs-display" style={{
                        fontSize: 20, lineHeight: 1.1, letterSpacing: '-0.02em',
                        fontStyle: selected ? 'italic' : 'normal',
                        color: selected ? opt.color : '#4A0E4E',
                        fontWeight: 800,
                      }}>
                        {opt.label}
                      </div>
                      <div style={{
                        fontSize: 13, color: '#573280', marginTop: 4, lineHeight: 1.4,
                        opacity: 0.82,
                      }}>
                        {opt.desc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Continue CTA (fixed) */}
        <button onClick={handleNext}
          disabled={!canContinue}
          aria-disabled={!canContinue}
          className="press lift" style={{
            width: '100%', marginTop: 18, flexShrink: 0,
            position: 'relative', overflow: 'hidden',
            padding: 18, minHeight: 56,
            background: canContinue
              ? 'linear-gradient(135deg, #FFD700 0%, #f06449 100%)'
              : 'rgba(74,14,78,0.08)',
            color: canContinue ? '#4A0E4E' : 'rgba(74,14,78,0.40)',
            border: 'none',
            borderRadius: 16,
            fontSize: 17, fontWeight: 800, letterSpacing: '-0.01em',
            cursor: canContinue ? 'pointer' : 'not-allowed',
            boxShadow: canContinue
              ? '0 12px 28px rgba(240,100,73,0.32), 0 4px 0 rgba(74,14,78,0.12)'
              : 'none',
          }}>
          {canContinue && <div className="a-shine" style={{ position: 'absolute', inset: 0 }} />}
          {isLast ? t.onboard_done : t.onboard_continue}
        </button>
      </div>
    </div>
  );
}
