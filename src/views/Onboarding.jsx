import { useState } from 'react';

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
      <div style={{ position: 'absolute', top: 60, right: -80, width: 220, height: 220,
        borderRadius: '50%', background: '#f9c74f', opacity: 0.15, filter: 'blur(80px)',
        pointerEvents: 'none' }} />

      <div style={{
        position: 'relative', zIndex: 1, padding: '16px 22px 28px',
        minHeight: '100%', display: 'flex', flexDirection: 'column',
      }}>
        {/* Header: skip + progress */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24,
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
            color: '#b8b8c8', padding: '12px 10px', minHeight: 44,
            fontSize: 22, fontWeight: 600, cursor: 'pointer',
            letterSpacing: '0.1em',
          }}>
            {t.onboard_skip}
          </button>
        </div>

        {/* Title */}
        <div className="a-fade-up" style={{ marginBottom: 6 }}>
          <div className="fs-display" style={{
            fontSize: 32, lineHeight: 1.05, letterSpacing: '-0.03em', marginBottom: 6,
          }}>
            {currentStep.question}
          </div>
          {currentStep.hint && (
            <div style={{ fontSize: 22, color: '#c8c8dc', marginTop: 4 }}>
              {currentStep.hint}
            </div>
          )}
        </div>

        {/* Body */}
        <div key={step} style={{ marginTop: 22, flex: 1 }}>
          {currentStep.type === 'people' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {analytics.users.map((u, i) => {
                const selected = draft.self === u.author;
                return (
                  <button key={u.author} dir="auto" onClick={() => setDraft({ ...draft, self: u.author })}
                    className="press lift" style={{
                      width: '100%', textAlign: 'start',
                      padding: '14px 16px', cursor: 'pointer',
                      background: selected
                        ? 'linear-gradient(135deg, rgba(249,199,79,0.18), rgba(249,199,79,0.04))'
                        : '#15151d',
                      border: `1px solid ${selected ? '#f9c74f' : '#2a2a36'}`,
                      borderRadius: 14, color: '#f4f4f8',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      animation: `fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) ${i * 0.04}s both`,
                    }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div dir="auto" style={{
                        fontSize: 23, fontWeight: selected ? 800 : 600,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {u.author}
                      </div>
                    </div>
                    {selected && (
                      <div style={{
                        width: 24, height: 24, borderRadius: '50%', background: '#f9c74f',
                        color: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
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
                        ? 'linear-gradient(135deg, rgba(249,199,79,0.18), rgba(249,199,79,0.04))'
                        : '#15151d',
                      border: `1px solid ${selected ? '#f9c74f' : '#2a2a36'}`,
                      borderRadius: 14, color: '#f4f4f8',
                      display: 'flex', alignItems: 'center', gap: 14,
                      animation: `fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) ${i * 0.05}s both`,
                    }}>
                    <div style={{ fontSize: 26 }}>{opt.icon}</div>
                    <div style={{ flex: 1, fontSize: 16, fontWeight: selected ? 800 : 600 }}>
                      {opt.label}
                    </div>
                    {selected && (
                      <div style={{
                        width: 22, height: 22, borderRadius: '50%', background: '#f9c74f',
                        color: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center',
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
                        : '#15151d',
                      border: `1px solid ${selected ? opt.color : '#2a2a36'}`,
                      borderRadius: 16, color: '#f4f4f8',
                      display: 'flex', alignItems: 'center', gap: 14,
                      animation: `fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) ${i * 0.06}s both`,
                      boxShadow: selected ? `0 8px 24px ${opt.color}22` : 'none',
                    }}>
                    <div style={{ fontSize: 32, lineHeight: 1 }}>{opt.icon}</div>
                    <div style={{ flex: 1 }}>
                      <div className="fs-display" style={{
                        fontSize: 22, lineHeight: 1, letterSpacing: '-0.02em',
                        fontStyle: selected ? 'italic' : 'normal',
                        color: selected ? opt.color : '#f4f4f8',
                      }}>
                        {opt.label}
                      </div>
                      <div style={{ fontSize: 22, color: '#dcdcec', marginTop: 5 }}>
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
            width: '100%', marginTop: 22, position: 'relative', overflow: 'hidden',
            padding: 18, minHeight: 56,
            background: canContinue
              ? 'linear-gradient(135deg, #f9c74f 0%, #ffd340 50%, #d4a820 100%)'
              : '#3a3a48',
            backgroundSize: '200% 200%',
            color: canContinue ? '#0a0a0f' : '#d6d6e0',
            border: 'none', borderRadius: 16,
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
