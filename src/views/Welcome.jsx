// ============================================================
// Welcome — first-run questionnaire. Asks name + location once,
// persists to localStorage so we can personalize copy on the
// Landing screen and beyond.
//
// Skipping is allowed (the rest of the app works fine without
// these fields). Either way we set cw_seen_welcome so the user
// doesn't hit the questionnaire again on the next visit.
// ============================================================
import { useState, useMemo } from 'react';
import BottomSheet from '../components/BottomSheet.jsx';
import { getCountries } from '../lib/countries.js';

const CREAM     = '#FFF6D6';
const PINK      = '#FDE6F1';
const EGGPLANT  = '#4A0E4E';
const PLUM      = '#2a0645';
const CORAL     = '#f06449';
const GOLD      = '#FFD700';
const MANGO     = '#FFC200';
const MUTED     = 'rgba(74,14,78,0.55)';
const BORDER    = 'rgba(74,14,78,0.12)';

export default function Welcome({ t, lang = 'en', onComplete }) {
  const [name, setName] = useState('');
  const [country, setCountry] = useState(null); // selected { code, name, flag } or null
  const [countryOpen, setCountryOpen] = useState(false);
  const [filter, setFilter] = useState('');

  // Built per-render but cheap enough; the list is ~200 items and
  // useMemo'd against the current locale.
  const countries = useMemo(() => getCountries(lang), [lang]);
  const filteredCountries = filter.trim()
    ? countries.filter(c => c.name.toLowerCase().includes(filter.trim().toLowerCase()))
    : countries;

  const submit = (skipped) => {
    onComplete({
      name: skipped ? '' : name.trim(),
      country: skipped ? '' : (country ? `${country.name} (${country.code})` : ''),
      countryCode: skipped ? '' : (country?.code || ''),
      skipped,
    });
  };

  const canContinue = name.trim().length > 0;

  return (
    <div style={{
      position: 'relative', height: '100%', overflow: 'hidden',
      background: `linear-gradient(180deg, ${CREAM} 0%, #FFF0E2 46%, ${PINK} 100%)`,
      display: 'flex', flexDirection: 'column',
      padding: 'calc(env(safe-area-inset-top, 0px) + 40px) 22px calc(env(safe-area-inset-bottom, 0px) + 24px)',
    }}>
      {/* warm blob background */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: 280, height: 280, borderRadius: '50%', background: GOLD, opacity: 0.20, filter: 'blur(72px)', top: -80, left: -60 }} />
        <div style={{ position: 'absolute', width: 220, height: 220, borderRadius: '50%', background: CORAL, opacity: 0.14, filter: 'blur(60px)', top: '24%', right: -60 }} />
        <div style={{ position: 'absolute', width: 240, height: 240, borderRadius: '50%', background: '#FF69B4', opacity: 0.12, filter: 'blur(72px)', bottom: -60, left: '12%' }} />
      </div>

      <div style={{
        position: 'relative', zIndex: 2,
        flex: 1, display: 'flex', flexDirection: 'column',
      }}>
        {/* hero */}
        <div className="a-fade-up">
          <div aria-hidden style={{ fontSize: 56, lineHeight: 1, marginBottom: 10 }}>👋</div>
          <div className="fs-display" style={{
            fontSize: 38, fontWeight: 800, color: PLUM,
            letterSpacing: '-0.04em', lineHeight: 1.02,
          }}>
            {t.welcome_title || 'Welcome'}
          </div>
          <div className="fs-sans" dir="auto" style={{
            marginTop: 8, fontSize: 15, lineHeight: 1.5,
            color: MUTED, fontWeight: 600,
          }}>
            {t.welcome_subtitle || "Two quick questions — then we're rolling."}
          </div>
        </div>

        {/* form */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 18,
          marginTop: 32, flexShrink: 0,
        }}>
          <label className="a-fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 7, animationDelay: '0.08s' }}>
            <span className="fs-mono" style={{
              fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase',
              color: CORAL, fontWeight: 800,
            }}>
              {t.welcome_name_label || "What's your name?"}
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.welcome_name_placeholder || 'Type your name'}
              autoFocus
              autoComplete="given-name"
              style={{
                appearance: 'none', width: '100%', padding: '14px 16px',
                background: '#fff', border: `2px solid ${BORDER}`,
                borderRadius: 14, color: EGGPLANT,
                fontSize: 17, fontFamily: 'inherit', fontWeight: 600,
                outline: 'none',
                boxShadow: '0 3px 0 rgba(74,14,78,0.06)',
              }}
              onFocus={(e) => { e.target.style.borderColor = CORAL; }}
              onBlur={(e)  => { e.target.style.borderColor = BORDER; }}
            />
          </label>

          <div className="a-fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 7, animationDelay: '0.16s' }}>
            <span className="fs-mono" style={{
              fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase',
              color: CORAL, fontWeight: 800,
            }}>
              {t.welcome_country_label || 'Where are you from?'}
            </span>
            <button
              type="button"
              onClick={() => setCountryOpen(true)}
              className="press"
              style={{
                appearance: 'none', width: '100%', padding: '14px 16px',
                background: '#fff', border: `2px solid ${BORDER}`,
                borderRadius: 14, color: country ? EGGPLANT : 'rgba(74,14,78,0.38)',
                fontSize: 17, fontFamily: 'inherit', fontWeight: 600,
                cursor: 'pointer', textAlign: 'start',
                display: 'flex', alignItems: 'center', gap: 10,
                boxShadow: '0 3px 0 rgba(74,14,78,0.06)',
              }}
            >
              {country ? (
                <>
                  <span className="cw-flag" style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>{country.flag}</span>
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{country.name}</span>
                </>
              ) : (
                <span style={{ flex: 1 }}>{t.welcome_country_placeholder || 'Country / City'}</span>
              )}
              <span aria-hidden style={{ fontSize: 16, color: MUTED, flexShrink: 0 }}>▾</span>
            </button>
          </div>
        </div>

        {/* spacer pushes CTA to bottom on tall screens */}
        <div style={{ flex: 1, minHeight: 24 }} />

        {/* CTA stack */}
        <div className="a-fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 10, animationDelay: '0.28s' }}>
          <button
            onClick={() => submit(false)}
            disabled={!canContinue}
            className="press"
            style={{
              width: '100%', padding: '17px 18px',
              background: canContinue
                ? `linear-gradient(135deg, ${GOLD} 0%, ${MANGO} 100%)`
                : 'rgba(74,14,78,0.10)',
              color: canContinue ? EGGPLANT : 'rgba(74,14,78,0.40)',
              border: `2px solid ${canContinue ? 'rgba(255,255,255,0.85)' : 'transparent'}`,
              borderRadius: 18, cursor: canContinue ? 'pointer' : 'default',
              fontSize: 17, fontWeight: 800, letterSpacing: '-0.01em',
              fontFamily: 'inherit',
              boxShadow: canContinue
                ? '0 6px 0 rgba(74,14,78,0.25), 0 14px 24px -6px rgba(74,14,78,0.30)'
                : 'none',
              transition: 'background 0.2s, color 0.2s, box-shadow 0.2s',
            }}
          >
            {t.welcome_continue || 'Continue →'}
          </button>
          <button
            onClick={() => submit(true)}
            type="button"
            className="press"
            style={{
              width: '100%', padding: '11px 18px',
              background: 'transparent', border: 'none',
              color: MUTED, cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
              textDecoration: 'underline', textUnderlineOffset: 3,
            }}
          >
            {t.welcome_skip || 'Skip'}
          </button>
        </div>
      </div>

      {countryOpen && (
        <BottomSheet
          light
          onClose={() => { setCountryOpen(false); setFilter(''); }}
          title={t.welcome_country_label || 'Where are you from?'}
        >
          {/* search filter */}
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t.welcome_country_search || 'Search…'}
            autoFocus
            style={{
              appearance: 'none', width: '100%', padding: '11px 14px',
              background: '#fff', border: `1.5px solid ${BORDER}`,
              borderRadius: 12, color: EGGPLANT,
              fontSize: 15, fontFamily: 'inherit', fontWeight: 600,
              outline: 'none', marginBottom: 10,
            }}
            onFocus={(e) => { e.target.style.borderColor = CORAL; }}
            onBlur={(e)  => { e.target.style.borderColor = BORDER; }}
          />
          {filteredCountries.length === 0 ? (
            <div className="fs-sans" style={{
              padding: '24px 8px', textAlign: 'center', color: MUTED,
              fontSize: 14,
            }}>
              {t.welcome_no_results || 'No countries match.'}
            </div>
          ) : (
            <div role="listbox" style={{ display: 'flex', flexDirection: 'column' }}>
              {filteredCountries.map(c => {
                const selected = country?.code === c.code;
                return (
                  <button
                    key={c.code}
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      setCountry(c);
                      setCountryOpen(false);
                      setFilter('');
                    }}
                    className="press"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      width: '100%', padding: '12px 8px',
                      background: selected ? 'rgba(240,100,73,0.10)' : 'transparent',
                      border: 'none', borderRadius: 10,
                      color: EGGPLANT, cursor: 'pointer',
                      fontSize: 16, fontFamily: 'inherit', fontWeight: 600,
                      textAlign: 'start',
                    }}
                  >
                    <span className="cw-flag" style={{ fontSize: 24, lineHeight: 1, flexShrink: 0 }}>{c.flag}</span>
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                    {selected && (
                      <span aria-hidden style={{ color: CORAL, fontSize: 18, flexShrink: 0 }}>✓</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </BottomSheet>
      )}
    </div>
  );
}
