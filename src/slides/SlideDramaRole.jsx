import React from 'react';
import SlideShell from './SlideShell.jsx';
import MedalCoin from '../components/MedalCoin.jsx';
import { useAnimatedNumber } from '../hooks/useAnimatedNumber.js';

const SlideDramaRole = React.memo(function SlideDramaRole({ u, t }) {
  // Determine role based on actual computed data
  let titleText, count, labelText, copyText, accent, emoji;
  if (u.conversationsRevived > u.conversationsKilled && u.conversationsRevived >= 5) {
    titleText = t.drama_defib;
    count = u.conversationsRevived;
    labelText = t.drama_defib_label;
    copyText = t.drama_defib_copy;
    accent = '#00BFFF'; emoji = '✨';
  } else if (u.conversationsKilled > u.conversationsRevived && u.conversationsKilled >= 5) {
    titleText = t.drama_killer;
    count = u.conversationsKilled;
    labelText = t.drama_killer_label;
    copyText = t.drama_killer_copy;
    accent = '#FF8C00'; emoji = '💀';
  } else if (u.replyReceivedRate > 0.5 && u.messageCount >= 20) {
    titleText = t.drama_replied;
    count = Math.round(u.replyReceivedRate * 100);
    labelText = t.drama_replied_label;
    copyText = t.drama_replied_copy;
    accent = '#FFB800'; emoji = '💬';
  } else if (u.ignoredRate > 0.25 && u.messageCount >= 20) {
    titleText = t.drama_ignored;
    count = Math.round(u.ignoredRate * 100);
    labelText = t.drama_ignored_label;
    copyText = t.drama_ignored_copy;
    accent = '#577590'; emoji = '🔕';
  } else {
    titleText = t.drama_steady;
    count = u.finalMessagesOfDay;
    labelText = t.drama_steady_label;
    copyText = t.drama_steady_copy;
    accent = '#8338EC'; emoji = '🧭';
  }

  const animated = useAnimatedNumber(count, 1400, [u.author]);
  const isPercent = labelText.startsWith('%');
  const cleanLabel = isPercent ? labelText.slice(1).trim() : labelText;

  return (
    <SlideShell accent={accent}>
      <div style={{
        position: 'absolute', inset: 0, height: '100%',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', padding: '0 24px',
      }}>
        <div className="fs-mono a-fade-up" style={{
          fontSize: 11, color: accent, letterSpacing: '0.2em', fontWeight: 800, textTransform: 'uppercase',
        }}>
          {t.drama_eyebrow}
        </div>

        {/* Hero medal — same minted-coin treatment as the badges slide */}
        <div className="a-pop-in" style={{ animationDelay: '0.18s', marginTop: 26 }}>
          <MedalCoin accent={accent} emoji={emoji} size={128} emojiSize={54} shineDur={4.6} shineDelay={0.3} />
        </div>

        <div className="a-spring" style={{ animationDelay: '0.42s', marginTop: 22 }}>
          <div className="fs-display" dir="auto" style={{
            // Three-tier sizing keeps long Hebrew/RTL titles from overflowing.
            fontSize: titleText.length > 26 ? 24 : titleText.length > 20 ? 28 : 34,
            lineHeight: 1.08, letterSpacing: '-0.04em',
            fontStyle: 'italic', color: accent, fontWeight: 800,
            overflowWrap: 'break-word', wordBreak: 'break-word', padding: '0 8px',
          }}>
            {titleText}
          </div>
        </div>

        {/* Stat — mono caption beside the animated number, mirroring the
            medal-and-mono-label pairing used under each badge coin. */}
        <div className="a-fade-up" style={{
          animationDelay: '0.7s', marginTop: 16,
          display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 10, maxWidth: 290,
        }}>
          <span className="fs-display" style={{
            fontSize: 42, lineHeight: 1, fontWeight: 800, letterSpacing: '-0.03em',
            color: '#2a0645', flexShrink: 0,
          }}>
            {animated}{isPercent ? '%' : ''}
          </span>
          <span className="fs-mono" dir="auto" style={{
            fontSize: 12, color: 'rgba(42,6,69,0.55)', fontWeight: 700, letterSpacing: '0.06em',
            textAlign: 'start', lineHeight: 1.35,
            overflowWrap: 'break-word', wordBreak: 'break-word',
          }}>
            {cleanLabel}
          </span>
        </div>

        <div className="fs-sans a-fade-up" dir="auto" style={{
          animationDelay: '1.1s', marginTop: 24,
          fontSize: 16, lineHeight: 1.5, color: 'rgba(74,14,78,0.72)', fontWeight: 500, maxWidth: 280,
          overflowWrap: 'break-word', wordBreak: 'break-word',
        }}>
          {copyText}
        </div>
      </div>
    </SlideShell>
  );
})

export default SlideDramaRole;
