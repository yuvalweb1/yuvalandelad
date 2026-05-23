import React from 'react';
import SlideShell from './SlideShell.jsx';
import { useAnimatedNumber } from '../hooks/useAnimatedNumber.js';

const SlideDramaRole = React.memo(function SlideDramaRole({ u, t }) {
  // Determine role based on actual computed data
  let titleText, count, labelText, copyText, accent, bg;
  if (u.conversationsRevived > u.conversationsKilled && u.conversationsRevived >= 5) {
    titleText = t.drama_defib;
    count = u.conversationsRevived;
    labelText = t.drama_defib_label;
    copyText = t.drama_defib_copy;
    accent = '#277da1';
    bg = '#577590';
  } else if (u.conversationsKilled > u.conversationsRevived && u.conversationsKilled >= 5) {
    titleText = t.drama_killer;
    count = u.conversationsKilled;
    labelText = t.drama_killer_label;
    copyText = t.drama_killer_copy;
    accent = '#f3722c';
    bg = '#577590';
  } else if (u.replyReceivedRate > 0.5 && u.messageCount >= 20) {
    titleText = t.drama_replied;
    count = Math.round(u.replyReceivedRate * 100);
    labelText = t.drama_replied_label;
    copyText = t.drama_replied_copy;
    accent = '#f9c74f';
    bg = '#f3722c';
  } else if (u.ignoredRate > 0.25 && u.messageCount >= 20) {
    titleText = t.drama_ignored;
    count = Math.round(u.ignoredRate * 100);
    labelText = t.drama_ignored_label;
    copyText = t.drama_ignored_copy;
    accent = '#577590';
    bg = '#f9c74f';
  } else {
    titleText = t.drama_steady;
    count = u.finalMessagesOfDay;
    labelText = t.drama_steady_label;
    copyText = t.drama_steady_copy;
    accent = '#277da1';
    bg = '#577590';
  }

  const animated = useAnimatedNumber(count, 1400, [u.author]);
  const isPercent = labelText.startsWith('%');
  const cleanLabel = isPercent ? labelText.slice(1).trim() : labelText;
  const isLightBg = bg === '#f9c74f';
  const bodyColor = isLightBg ? 'rgba(87,117,144,0.88)' : 'rgba(42,6,69,0.85)';
  const heroColor = isLightBg ? '#1a1a2e' : '#2a0645';

  return (
    <SlideShell bg={bg} accent={accent}>
      <div style={{
        position: 'relative', height: '100%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        textAlign: 'center', padding: '0 24px',
      }}>
        <div className="fs-sans a-fade-up" style={{ fontSize: 12, color: accent, letterSpacing: '0.15em', fontWeight: 500, textTransform: 'uppercase' }}>
          {t.drama_eyebrow}
        </div>
        <div className="a-spring" style={{ animationDelay: '0.3s', marginTop: 32 }}>
          <div className="fs-display" style={{
            fontSize: titleText.length > 20 ? 28 : 36,
            lineHeight: 1.15, letterSpacing: '-0.03em', fontStyle: 'italic', color: accent, fontWeight: 700,
          }}>
            {titleText}
          </div>
        </div>
        <div className="a-spring" style={{ animationDelay: '0.7s', marginTop: 40 }}>
          <div className="fs-display" style={{
            fontSize: 56, lineHeight: 1.1, letterSpacing: '-0.04em', color: heroColor, fontWeight: 800,
          }}>
            {animated}{isPercent ? '%' : ''}
          </div>
          <div className="fs-mono" style={{
            fontSize: 16, color: bodyColor, letterSpacing: '0.08em', marginTop: 8,
          }}>
            {cleanLabel}
          </div>
        </div>
        <div className="fs-sans a-fade-up" style={{
          animationDelay: '1.3s', marginTop: 32, fontSize: 18, lineHeight: 1.5, color: bodyColor,
        }}>
          {copyText}
        </div>
      </div>
    </SlideShell>
  );
})

export default SlideDramaRole;
