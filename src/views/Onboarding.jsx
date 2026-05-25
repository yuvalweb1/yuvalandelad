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
        { value: 'medium', label: t.q_tone_medium, desc: t.q_tone_medium_d, color: '#f9c74f', icon: '😏' },
        { value: 'spicy', label: t.q_tone_spicy, desc: t.q_tone_spicy_d, color: '#f3722c', icon: '🔥' },
      ],
    },
  ];

  const currentStep = steps[step];
  const currentValue = draft[currentStep.key];
  const canContinue = currentValue !== null;
  const isLast = step === steps.length - 1;

  const handleNext = () => {
    if (isLast) {
      onComplete(draft);
    } else {
      setStep(step + 1);
    }
  };

  return (
    <div className="no-sb" style={{
      position: 'relative', height: '100%', overflow: 'auto',
      background: 'radial-gradient(ellipse at top, #577590 0%, #050507 70%)',
    }}>
      {/* Decorative gradient blobs — set the mood without competing with content */}
      <div aria-hidden="true" style={{
        position: 'absolute', top: 40, right: -120, width: 320, height: 320,
        borderRadius: '50%', background: '#f9c74f', opacity: 0.16, filter: 'blur(90px)',
        pointerEvents: 'none',
      }} />
      <div aria-hidden="true" style={{
        position: 'absolute', bottom: -100, left: -100, width: 340, height: 340,
        borderRadius: '50%', background: '#577590', opacity: 0.32, filter: 'blur(110px)',
        pointerEvents: 'none',
      }} />

      {/* Decorative floating chat bubbles — subtle visual richness, matches Landing's motif */}
      <div aria-hidden="true" className="a-float" style={{
        position: 'absolute', top: '22%', left: '6%',
        width: 54, height: 36, background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: '18px 18px 18px 4px',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
        pointerEvents: 'none',
      }}>
        {[0, 1, 2].map(d => (
          <span key={d} style={{ width: 5, height: 5, borderRadius: 999, background: 'rgba(249,199,79,0.65)' }} />
        ))}
      </div>
      <div aria-hidden="true" className="a-float" style={{
        position: 'absolute', bottom: '14%', right: '7%',
        width: 38, height: 28, background: 'rgba(249,199,79,0.08)',
        border: '1px solid rgba(249,199,79,0.22)',
        borderRadius: '16px 16px 4px 16px',
        animationDelay: '1.4s',
        pointerEvents: 'none',
      }} />

      {/* Centered content column — caps line length for readability on any screen */}
      <div style={{
        position: 'relative', zIndex: 1,
        maxWidth: 520, margin: '0 auto',
        padding: '18px 22px 28px',
        minHeight: '100%', display: 'flex', flexDirection: 'column',
      }}>
        {/* Header: progress + skip */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28,
        }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {steps.map((_, i) => (
              <div key={i} style={{
                width: i === step ? 28 : 8, height: 4, borderRadius: 999,
                background: i <= step ? '#f9c74f' : 'rgba(255,255,255,0.18)',
                transition: 'width 0.35s, background 0.3s',
              }} />
            ))}
          </div>
          <button onClick={onSkip} className="fs-mono press" style={{
            background: 'transparent', border: 'none',
            color: '#b8b8c8', padding: '10px 8px', minHeight: 44,
            fontSize: 14, fontWeight: 600, cursor: 'pointer',
            letterSpacing: '0.12em', textTransform: 'uppercase',
          }}>
            {t.onboard_skip}
          </button>
        </div>

        {/* Title */}
        <div className="a-fade-up" style={{ marginBottom: 4 }}>
          <div className="fs-display" style={{
            fontSize: 34, lineHeight: 1.05, letterSpacing: '-0.03em', marginBottom: 8,
            fontWeight: 800,
          }}>
            {currentStep.question}
          </div>
          {currentStep.hint && (
            <div style={{ fontSize: 15, color: '#b8b8c8', marginTop: 4, lineHeight: 1.4 }}>
              {currentStep.hint}
            </div>
          )}
        </div>

        {/* Body — vertically centered when there's room, scrollable when there isn't */}
        <div key={step} style={{
          marginTop: 28, flex: 1,
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
        }}>
          {currentStep.type === 'people' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
                        ? 'linear-gradient(135deg, rgba(249,199,79,0.20), rgba(249,199,79,0.05))'
                        : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${selected ? '#f9c74f' : 'rgba(255,255,255,0.10)'}`,
                      borderRadius: 16, color: '#f4f4f8',
                      display: 'flex', alignItems: 'center', gap: 14,
                      animation: `fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) ${i * 0.04}s both`,
                      boxShadow: selected ? '0 12px 32px rgba(249,199,79,0.18)' : 'none',
                      transition: 'background 0.2s, border-color 0.2s, box-shadow 0.2s',
                    }}>
                    {/* Avatar */}
                    <div style={{
                      width: 44, height: 44, borderRadius: '50%',
                      background: selected
                        ? 'linear-gradient(135deg, #f9c74f 0%, #ffd340 100%)'
                        : 'rgba(255,255,255,0.06)',
                      border: selected ? 'none' : '1px solid rgba(255,255,255,0.08)',
                      color: selected ? '#1B1813' : '#f4f4f8',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 18, fontWeight: 700, flexShrink: 0,
                      fontFamily: 'Bricolage Grotesque, DM Sans, sans-serif',
                      transition: 'background 0.2s, color 0.2s',
                    }}>
                      {initial}
                    </div>

                    {/* Name + meta */}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div dir="auto" style={{
                        fontSize: 17, fontWeight: selected ? 800 : 600,
                        lineHeight: 1.2,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {u.author}
                      </div>
                      {msgCount > 0 && (
                        <div className="fs-mono" style={{
                          fontSize: 12, color: selected ? '#f9c74f' : '#8a8aa0',
                          marginTop: 3, letterSpacing: '0.02em',
                        }}>
                          {msgCount.toLocaleString()} {t.go_messages || 'messages'}
                        </div>
                      )}
                    </div>

                    {/* Checkmark */}
                    {selected && (
                      <div style={{
                        width: 24, height: 24, borderRadius: '50%', background: '#f9c74f',
                        color: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center',
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
                        ? 'linear-gradient(135deg, rgba(249,199,79,0.20), rgba(249,199,79,0.05))'
                        : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${selected ? '#f9c74f' : 'rgba(255,255,255,0.10)'}`,
                      borderRadius: 16, color: '#f4f4f8',
                      display: 'flex', alignItems: 'center', gap: 14,
                      animation: `fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) ${i * 0.05}s both`,
                      boxShadow: selected ? '0 12px 32px rgba(249,199,79,0.18)' : 'none',
                      transition: 'background 0.2s, border-color 0.2s, box-shadow 0.2s',
                    }}>
                    <div style={{ fontSize: 26, lineHeight: 1, flexShrink: 0 }}>{opt.icon}</div>
                    <div style={{ flex: 1, fontSize: 16, fontWeight: selected ? 800 : 600 }}>
                      {opt.label}
                    </div>
                    {selected && (
                      <div style={{
                        width: 22, height: 22, borderRadius: '50%', background: '#f9c74f',
                        color: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center',
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
                        ? `linear-gradient(135deg, ${opt.color}28, ${opt.color}08)`
                        : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${selected ? opt.color : 'rgba(255,255,255,0.10)'}`,
                      borderRadius: 18, color: '#f4f4f8',
                      display: 'flex', alignItems: 'center', gap: 14,
                      animation: `fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) ${i * 0.06}s both`,
                      boxShadow: selected ? `0 12px 28px ${opt.color}33` : 'none',
                      transition: 'background 0.2s, border-color 0.2s, box-shadow 0.2s',
                    }}>
                    <div style={{ fontSize: 32, lineHeight: 1, flexShrink: 0 }}>{opt.icon}</div>
                    <div style={{ flex: 1 }}>
                      <div className="fs-display" style={{
                        fontSize: 20, lineHeight: 1.1, letterSpacing: '-0.02em',
                        fontStyle: selected ? 'italic' : 'normal',
                        color: selected ? opt.color : '#f4f4f8',
                        fontWeight: 800,
                      }}>
                        {opt.label}
                      </div>
                      <div style={{ fontSize: 13, color: '#b8b8c8', marginTop: 4, lineHeight: 1.4 }}>
                        {opt.desc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Continue CTA */}
        <button onClick={handleNext}
          disabled={!canContinue}
          aria-disabled={!canContinue}
          className="press lift a-gradient-shift" style={{
            width: '100%', marginTop: 28, position: 'relative', overflow: 'hidden',
            padding: 18, minHeight: 56,
            background: canContinue
              ? 'linear-gradient(135deg, #f9c74f 0%, #ffd340 50%, #d4a820 100%)'
              : 'rgba(255,255,255,0.06)',
            backgroundSize: '200% 200%',
            color: canContinue ? '#0a0a0f' : '#6d6d80',
            border: canContinue ? 'none' : '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16,
            fontSize: 17, fontWeight: 800, letterSpacing: '-0.01em',
            cursor: canContinue ? 'pointer' : 'not-allowed',
            boxShadow: canContinue ? '0 12px 32px rgba(249,199,79,0.40)' : 'none',
          }}>
          {canContinue && <div className="a-shine" style={{ position: 'absolute', inset: 0 }} />}
          {isLast ? t.onboard_done : t.onboard_continue}
        </button>
      </div>
    </div>
  );
}
