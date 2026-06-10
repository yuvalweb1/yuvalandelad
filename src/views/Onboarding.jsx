import { useState } from 'react';

// Take the first visible character of a name (skips spaces, handles emoji/RTL).
function nameInitial(name) {
  const trimmed = (name || '').trim();
  if (!trimmed) return '?';
  const first = Array.from(trimmed)[0];
  return first.toUpperCase();
}

// Try to match the name the user entered in the Welcome questionnaire
// against the chat participants. Case-insensitive substring match both
// ways so "Yuval" matches "Yuval Himmel" and "ynh" doesn't false-match
// long names. Returns the matched author or null.
function matchUserByName(userName, users) {
  if (!userName || !users?.length) return null;
  const needle = userName.trim().toLowerCase();
  if (needle.length < 2) return null;
  // Prefer exact (case-insensitive) match first.
  const exact = users.find(u => u.author?.toLowerCase() === needle);
  if (exact) return exact.author;
  // Then "author starts with name" — handles "Yuval" → "Yuval Himmel".
  const startsWith = users.find(u => u.author?.toLowerCase().startsWith(needle));
  if (startsWith) return startsWith.author;
  // Then "name starts with author" — handles "Yuval Himmel" typed as
  // welcome name vs. just "Yuval" in WhatsApp.
  const reverse = users.find(u => u.author && needle.startsWith(u.author.toLowerCase()));
  if (reverse) return reverse.author;
  // Last resort: any substring containment in either direction. Only
  // accept if the result is unique to avoid auto-picking the wrong
  // person (e.g. "n" matching three users).
  const contains = users.filter(u =>
    u.author && (u.author.toLowerCase().includes(needle) || needle.includes(u.author.toLowerCase()))
  );
  return contains.length === 1 ? contains[0].author : null;
}

export default function Onboarding({ analytics, t, profile, setProfile, userName, onComplete, onSkip }) {
  // If we can match the Welcome name to an actual participant, prefill
  // `self` AND start at step 1 (relationship) — no need to ask who they
  // are. Falls back to the picker when there's no confident match.
  const autoMatchedSelf = profile.self || matchUserByName(userName, analytics.users);
  const skipSelfStep = !profile.self && !!autoMatchedSelf;
  const [step, setStep] = useState(skipSelfStep ? 1 : 0);
  const [draft, setDraft] = useState({
    self: autoMatchedSelf || analytics.users[0]?.author || null,
    relationship: profile.relationship || null,
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
        // Bottom padding clears the home indicator + adds breathing room so
        // the Continue CTA isn't glued to the screen edge on phones.
        padding: '18px 22px calc(env(safe-area-inset-bottom, 0px) + 28px)',
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
