import { createElement } from 'react';
import SlideDramaRole from './SlideDramaRole.jsx';
import SlideAwards from './SlideAwards.jsx';
import SlideGroupOverview from './SlideGroupOverview.jsx';
import SlideLeaderboard from './SlideLeaderboard.jsx';
import SlidePerPerson from './SlidePerPerson.jsx';
import SlideSignatureWords from './SlideSignatureWords.jsx';
import SlideGroupTop from './SlideGroupTop.jsx';
import SlidePhotos from './SlidePhotos.jsx';
import SlideAd from './SlideAd.jsx';
import SlideTeaser from './SlideTeaser.jsx';
import SlideMetric, { metricHasData } from './SlideMetric.jsx';
import SlideLongestStreak from './SlideLongestStreak.jsx';
import SlideBusiestWeekday from './SlideBusiestWeekday.jsx';
import SlideSignatureEmoji from './SlideSignatureEmoji.jsx';

// Tiny wrapper factory: each metric id renders the shared SlideMetric base
// with a fixed metricKey. Lets the slide registry stay id → component.
// Uses createElement (not JSX) so this file can stay .js.
const metricSlide = (metricKey) => {
  const Wrapped = (props) => createElement(SlideMetric, { ...props, metricKey });
  Wrapped.displayName = `SlideMetric(${metricKey})`;
  return Wrapped;
};

// id → component lookup used by Wrapped. Every id used in SLIDES_BY_TYPE
// MUST appear here.
export const SLIDE_COMPONENTS = {
  // Original group slides
  group_overview:  SlideGroupOverview,
  leaderboard:     SlideLeaderboard,
  per_person:      SlidePerPerson,
  signature_words: SlideSignatureWords,
  group_top:       SlideGroupTop,
  photos:          SlidePhotos,
  awards:          SlideAwards,
  drama_role:      SlideDramaRole,
  ad:              SlideAd,
  teaser:          SlideTeaser,
  // New typed slides
  night_owls:          metricSlide('night_owls'),
  early_birds:         metricSlide('early_birds'),
  voice_notes_leader:  metricSlide('voice_notes_leader'),
  overtime:            metricSlide('overtime'),
  response_times:      metricSlide('response_times'),
  essay_writers:       metricSlide('essay_writers'),
  link_sharers:        metricSlide('link_sharers'),
  double_texts:        metricSlide('double_texts'),
  ignored_award:       metricSlide('ignored_award'),
  night_messages:      metricSlide('night_messages'),
  longest_streak:      SlideLongestStreak,
  busiest_weekday:     SlideBusiestWeekday,
  signature_emoji:     SlideSignatureEmoji,
};

// Per chat-type ordered lineup. Wrapped filters this further at render time —
// a slide drops out if its data is empty (handled in slideHasData below).
//
// 'other' is the legacy default; do not change without coordinating with copy.
export const SLIDES_BY_TYPE = {
  friends: [
    'group_overview',
    'leaderboard',
    'night_owls',
    'signature_words',
    'group_top',
    'signature_emoji',
    'ignored_award',
    'photos',
    'awards',
    'drama_role',
    'teaser',
  ],
  family: [
    'group_overview',
    'early_birds',
    'leaderboard',
    'voice_notes_leader',
    'photos',
    'per_person',
    'signature_words',
    'group_top',
    'awards',
    'teaser',
  ],
  work: [
    'group_overview',
    'overtime',
    'response_times',
    'essay_writers',
    'busiest_weekday',
    'link_sharers',
    'leaderboard',
    'signature_words',
    'awards',
    'teaser',
  ],
  couple: [
    'group_overview',
    'per_person',
    'double_texts',
    'response_times',
    'longest_streak',
    'signature_emoji',
    'signature_words',
    'photos',
    'night_messages',
    'awards',
    'teaser',
  ],
  other: [
    'group_overview',
    'leaderboard',
    'per_person',
    'signature_words',
    'group_top',
    'photos',
    'awards',
    'drama_role',
    'ad',
    'teaser',
  ],
};

// Legacy default (consumed by anything still importing SLIDES_DEF).
export const SLIDES_DEF = SLIDES_BY_TYPE.other;

// Per-slide data check. Returns false → Wrapped drops that slide from the deck.
// Keeps slides "verified data only" — never show an empty leaderboard.
export function slideHasData(id, analytics, user) {
  switch (id) {
    case 'signature_words':
      return analytics.users.some(x => x.topWord);
    case 'group_top':
      return (analytics.topWordsGroup && analytics.topWordsGroup.length > 0)
        || (analytics.topEmojisGroup && analytics.topEmojisGroup.length > 0);
    case 'photos':
      return analytics.photos && analytics.photos.length > 0;
    case 'drama_role':
      return !!user;
    case 'signature_emoji':
      return analytics.users.some(x => x.topEmoji);
    case 'longest_streak':
      return analytics.users.some(x => x.longestStreak >= 2);
    case 'busiest_weekday':
      return (analytics.groupWeekly || []).some(v => v > 0);
    case 'night_owls':
    case 'early_birds':
    case 'voice_notes_leader':
    case 'overtime':
    case 'response_times':
    case 'essay_writers':
    case 'link_sharers':
    case 'double_texts':
    case 'ignored_award':
    case 'night_messages':
      return metricHasData(id, analytics);
    default:
      return true;
  }
}
