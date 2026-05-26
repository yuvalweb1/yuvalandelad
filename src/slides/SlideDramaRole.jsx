import React from 'react';
import SlideShell from './SlideShell.jsx';
import ListSlideDecor from '../components/ListSlideDecor.jsx';
import { useAnimatedNumber } from '../hooks/useAnimatedNumber.js';

const SlideDramaRole = React.memo(function SlideDramaRole({ u, t }) {
  // Determine role based on actual computed data
  let titleText, count, labelText, copyText, accent, deep;
  if (u.conversationsRevived > u.conversationsKilled && u.conversationsRevived >= 5) {
    titleText = t.drama_defib;
    count = u.conversationsRevived;
    labelText = t.drama_defib_label;
    copyText = t.drama_defib_copy;
    accent = '#00BFFF'; deep = '#0089C4';
  } else if (u.conversationsKilled > u.conversationsRevived && u.conversationsKilled >= 5) {
    titleText = t.drama_killer;
    count = u.conversationsKilled;
    labelText = t.drama_killer_label;
    copyText = t.drama_killer_copy;
    accent = '#FF8C00'; deep = '#D17000';
  } else if (u.replyReceivedRate > 0.5 && u.messageCount >= 20) {
    titleText = t.drama_replied;
    count = Math.round(u.replyReceivedRate * 100);
    labelText = t.drama_replied_label;
    copyText = t.drama_replied_copy;
    accent = '#FFB800'; deep = '#C28800';
  } else if (u.ignoredRate > 0.25 && u.messageCount >= 20) {
    titleText = t.drama_ignored;
    count = Math.round(u.ignoredRate * 100);
    labelText = t.drama_ignored_label;
    copyText = t.drama_ignored_copy;
    accent = '#577590'; deep = '#3D526B';
  } else {
    titleText = t.drama_steady;
    count = u.finalMessagesOfDay;
    labelText = t.drama_steady_label;
    copyText = t.drama_steady_copy;
    accent = '#8338EC'; deep = '#6624B0';
  }

  const animated = useAnimatedNumber(count, 1400, [u.author]);
  const isPercent = labelText.startsWith('%');
  const cleanLabel = isPercent ? labelText.slice(1).trim() : labelText;

  return (
    <SlideShell bg="#577590" accent={accent}>
      <ListSlideDecor emojis={['🎭', '✨', '💥', '🌟', '🎬', '🎲']} />
      <div style={{
        position: 'relative', zIndex: 1, height: '100%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        textAlign: 'center', padding: '0 24px',
      }}>
        <div className="fs-sans a-fade-up" style={{
          fontSize: 13, color: accent, letterSpacing: '0.2em', fontWeight: 800, textTransform: 'uppercase',
        }}>
          🎭 {t.drama_eyebrow}
        </div>

        <div className="a-spring" style={{ animationDelay: '0.3s', marginTop: 20 }}>
          <div className="fs-display" dir="auto" style={{
            // Three-tier sizing keeps long Hebrew/RTL titles from overflowing.
            fontSize: titleText.length > 26 ? 30 : titleText.length > 20 ? 36 : 46,
            lineHeight: 1.08, letterSpacing: '-0.04em',
            fontStyle: 'italic', color: accent, fontWeight: 800,
            textShadow: '0 2px 0 rgba(255,255,255,0.55), 0 1px 3px rgba(74,14,78,0.12)',
            overflowWrap: 'break-word', wordBreak: 'break-word', padding: '0 8px',
          }}>
            {titleText}
          </div>
        </div>

        {/* big stat in a sticker card */}
        <div className="a-spring" style={{ animationDelay: '0.7s', marginTop: 32 }}>
          <div style={{
            display: 'inline-block',
            padding: '18px 30px',
            background: '#fff', borderRadius: 28,
            border: '3px solid rgba(255,255,255,0.9)',
            boxShadow: `0 8px 0 ${deep}33, 0 18px 32px -8px ${deep}55`,
            transform: 'rotate(-1.5deg)',
            minWidth: 160,
          }}>
            <div className="fs-display" style={{
              fontSize: 60, lineHeight: 1, letterSpacing: '-0.04em', color: '#4A0E4E', fontWeight: 800,
            }}>
              {animated}{isPercent ? '%' : ''}
            </div>
            <div className="fs-mono" style={{
              fontSize: 12, color: deep, letterSpacing: '0.12em', marginTop: 8, fontWeight: 800, textTransform: 'uppercase',
              overflowWrap: 'break-word', wordBreak: 'break-word',
            }}>
              {cleanLabel}
            </div>
          </div>
        </div>

        <div className="fs-sans a-fade-up" dir="auto" style={{
          animationDelay: '1.3s', marginTop: 26,
          fontSize: 17, lineHeight: 1.5, color: 'rgba(74,14,78,0.78)', fontWeight: 500,
          overflowWrap: 'break-word', wordBreak: 'break-word',
        }}>
          {copyText}
        </div>
      </div>
    </SlideShell>
  );
})

export default SlideDramaRole;
