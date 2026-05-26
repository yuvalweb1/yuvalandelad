// ============================================================
// ShareSheet — Spotify-style share modal. Bottom sheet that slides up
// with a preview card, a horizontal scroller of channel icons (WhatsApp,
// Telegram, X, Email, SMS), and a stacked action list (copy / native share).
//
// All "channels" are URL schemes (wa.me, t.me, twitter.com/intent, mailto:,
// sms:) — opened in a new tab/native app, NO direct API call from our code.
// The Web Share API surfaces the OS share sheet on mobile when available.
// ============================================================
import { useEffect, useState } from 'react';

// Compose the share URL from the live origin so it works wherever the
// app is hosted. Falls back to a sensible default during SSR / build.
function appUrl() {
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    return window.location.origin;
  }
  return 'https://chatwrapped.app';
}

// Brand-colored circular icon. Children is the glyph (SVG or text).
function ChannelIcon({ label, color, glyph, href, textColor = '#fff', onPick }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => setTimeout(onPick, 200)}
      className="press"
      style={{
        flexShrink: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: 7, textDecoration: 'none',
        color: '#fff', minWidth: 64, paddingTop: 2,
      }}
    >
      <div style={{
        width: 56, height: 56, borderRadius: '50%',
        background: color, color: textColor,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: `0 8px 20px ${color}66, 0 2px 0 rgba(0,0,0,0.18) inset`,
        border: '1px solid rgba(255,255,255,0.10)',
      }}>
        {glyph}
      </div>
      <div className="fs-sans" style={{
        fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.85)',
        letterSpacing: '-0.01em',
      }}>{label}</div>
    </a>
  );
}

// Single row in the bottom action list (copy, native share, etc.).
function ActionRow({ icon, label, hint, onClick }) {
  return (
    <button onClick={onClick} className="press" style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 14,
      padding: '12px 6px', background: 'transparent', border: 'none',
      color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer',
      textAlign: 'start', borderRadius: 10,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: '50%',
        background: 'rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, flexShrink: 0,
      }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em',
        }}>{label}</div>
        {hint && (
          <div className="fs-mono" style={{
            fontSize: 10, color: 'rgba(255,255,255,0.50)', marginTop: 2,
            letterSpacing: '0.06em',
          }}>{hint}</div>
        )}
      </div>
    </button>
  );
}

export default function ShareSheet({ open, onClose, title, text, t }) {
  const [copied, setCopied] = useState(null);

  // ESC closes the sheet for desktop users.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const url = appUrl();
  const fullText = `${text}\n\n— ${t.share_get_yours || 'Get yours'}: ${url}`;

  function flashCopied(which) {
    setCopied(which);
    clearTimeout(flashCopied._id);
    flashCopied._id = setTimeout(() => setCopied(null), 1500);
  }

  async function copyText() {
    try { await navigator.clipboard.writeText(fullText); flashCopied('text'); } catch {}
  }
  async function copyLink() {
    try { await navigator.clipboard.writeText(url); flashCopied('link'); } catch {}
  }
  async function nativeShare() {
    if (!navigator.share) return;
    try { await navigator.share({ title, text, url }); onClose(); }
    catch { /* user cancelled — ignore */ }
  }

  const hasNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  // Channel deep-link list — all open the platform's native share dialog
  // populated with our text. None makes an API call from our app.
  const channels = [
    {
      id: 'whatsapp', label: 'WhatsApp', color: '#25D366',
      href: `https://wa.me/?text=${encodeURIComponent(fullText)}`,
      glyph: (
        <svg width="28" height="28" viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
          <path d="M16 3C9.4 3 4 8.4 4 15c0 2.4.7 4.7 2 6.7L4 29l7.5-2c1.9 1 4.1 1.6 6.5 1.6 6.6 0 12-5.4 12-12S22.6 3 16 3zm6.9 17.3c-.3.8-1.7 1.5-2.4 1.6-.6.1-1.4.1-2.2-.1-.5-.2-1.2-.4-2-.8-3.5-1.5-5.8-5.1-6-5.3-.2-.2-1.4-1.8-1.4-3.5s.9-2.5 1.2-2.8c.3-.3.7-.4 1-.4h.7c.2 0 .5-.1.8.6.3.7 1 2.5 1.1 2.7.1.2.1.4 0 .6-.1.2-.2.4-.4.6-.2.2-.4.5-.5.6-.2.2-.4.4-.2.8s1 1.7 2.2 2.7c1.5 1.3 2.7 1.7 3.1 1.9.4.2.6.2.8-.1.2-.3.9-1 1.1-1.4.2-.4.4-.3.7-.2.3.1 1.9.9 2.2 1.1.3.2.5.2.6.4.1.2.1 1-.2 1.8z"/>
        </svg>
      ),
    },
    {
      id: 'telegram', label: 'Telegram', color: '#229ED9',
      href: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
      glyph: (
        <svg width="26" height="26" viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
          <path d="M27.3 4.2 3.8 13.3c-1.6.6-1.6 1.6-.3 2l6 1.9 13.9-8.8c.7-.4 1.3-.2.8.3l-11.3 10.2-.4 6 2.6.1 3.4-3.3 6 4.4c1.1.6 1.9.3 2.2-1l3.9-18.6c.4-1.6-.6-2.4-1.7-1.9z"/>
        </svg>
      ),
    },
    {
      id: 'twitter', label: 'X', color: '#000',
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(fullText)}`,
      glyph: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
      ),
    },
    {
      id: 'email', label: 'Email', color: '#7c7c89',
      href: `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(fullText)}`,
      glyph: (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m3 7 9 6 9-6" />
        </svg>
      ),
    },
    {
      id: 'sms', label: 'SMS', color: '#34C759',
      href: `sms:?&body=${encodeURIComponent(fullText)}`,
      glyph: (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
      ),
    },
  ];

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} aria-hidden="true" style={{
        position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.75)',
        zIndex: 60, animation: 'fadeIn 0.2s ease-out both',
      }} />

      {/* Sheet */}
      <div role="dialog" aria-modal="true" className="no-sb" style={{
        position: 'absolute', insetInlineStart: 0, insetInlineEnd: 0, bottom: 0,
        overflowY: 'auto', background: '#1a0a14',
        borderRadius: '28px 28px 0 0', zIndex: 61,
        maxHeight: '88%', padding: '12px 18px 24px',
        borderTop: '1px solid rgba(243,114,44,0.30)',
        boxShadow: '0 -20px 60px -10px rgba(0,0,0,0.6)',
        animation: 'fadeUp 0.32s cubic-bezier(0.2, 0.8, 0.2, 1)',
      }}>
        {/* Drag handle */}
        <div aria-hidden="true" style={{
          margin: '0 auto 14px',
          width: 40, height: 4, background: 'rgba(255,255,255,0.22)', borderRadius: 999,
        }} />

        {/* Title */}
        <div className="fs-display" style={{
          fontSize: 19, color: '#fff', fontWeight: 800, letterSpacing: '-0.02em',
          textAlign: 'center', marginBottom: 14,
        }}>
          {t.share_title || 'Share'}
        </div>

        {/* Preview card — looks like the verdict card the user is sharing */}
        <div style={{
          background: 'radial-gradient(circle at 0% 0%, #3a1812 0%, #1a0606 60%)',
          border: '1px solid rgba(243,114,44,0.30)',
          borderRadius: 18, padding: '14px 16px 16px',
          marginBottom: 20, position: 'relative', overflow: 'hidden',
        }}>
          <div aria-hidden="true" style={{
            position: 'absolute', top: -30, insetInlineEnd: -30,
            width: 110, height: 110, borderRadius: '50%',
            background: '#f9c74f', opacity: 0.16, filter: 'blur(38px)',
          }} />
          <div className="fs-mono" style={{
            fontSize: 9, color: '#f9c74f', letterSpacing: '0.24em',
            fontWeight: 800, textTransform: 'uppercase', position: 'relative',
          }}>✦ {t.share_preview_label || 'Roast preview'}</div>
          <div dir="auto" className="fs-display" style={{
            fontSize: 15, color: '#fff', marginTop: 6, lineHeight: 1.4,
            fontStyle: 'italic', overflowWrap: 'break-word', wordBreak: 'break-word',
            position: 'relative', fontWeight: 700,
          }}>
            {text}
          </div>
        </div>

        {/* Channel icons row — horizontal scroll, big-vibe like Spotify */}
        <div className="no-sb" style={{
          display: 'flex', gap: 12, overflowX: 'auto',
          paddingBottom: 6, marginBottom: 18,
          marginInline: -4, paddingInline: 4,
        }}>
          {channels.map(c => (
            <ChannelIcon key={c.id} {...c} onPick={onClose} />
          ))}
        </div>

        {/* Divider */}
        <div aria-hidden="true" style={{
          height: 1, background: 'rgba(255,255,255,0.08)',
          marginBottom: 8, marginInline: -6,
        }} />

        {/* Action list */}
        <ActionRow
          icon="📋"
          label={copied === 'text' ? (t.share_copied || 'Copied!') : (t.share_copy_text || 'Copy text')}
          hint={t.share_copy_text_hint || 'Roast + link'}
          onClick={copyText}
        />
        <ActionRow
          icon="🔗"
          label={copied === 'link' ? (t.share_copied || 'Copied!') : (t.share_copy_link || 'Copy link')}
          hint={url.replace(/^https?:\/\//, '')}
          onClick={copyLink}
        />
        {hasNativeShare && (
          <ActionRow
            icon="📤"
            label={t.share_more || 'More options'}
            hint={t.share_more_hint || 'Use system share sheet'}
            onClick={nativeShare}
          />
        )}

        {/* Cancel */}
        <button onClick={onClose} className="press" style={{
          width: '100%', marginTop: 14, padding: '14px',
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.14)',
          borderRadius: 14, color: '#fff', fontWeight: 700, fontSize: 14,
          cursor: 'pointer', letterSpacing: '-0.01em',
        }}>
          {t.share_cancel || 'Cancel'}
        </button>
      </div>
    </>
  );
}
