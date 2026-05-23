import SlideDramaRole from './SlideDramaRole.jsx';
import SlideAwards from './SlideAwards.jsx';
import SlideGroupOverview from './SlideGroupOverview.jsx';
import SlideLeaderboard from './SlideLeaderboard.jsx';
import SlidePerPerson from './SlidePerPerson.jsx';
import SlideSignatureWords from './SlideSignatureWords.jsx';
import SlideGroupTop from './SlideGroupTop.jsx';
import SlidePhotos from './SlidePhotos.jsx';
import SlideTeaser from './SlideTeaser.jsx';

// Auto-play order. Wrapped filters this further based on which slides have
// data (signature_words/group_top skip when analytics is empty, photos when
// the export has no media, drama_role when the selected user is missing).
export const SLIDES_DEF = [
  'group_overview',
  'leaderboard',
  'per_person',
  'signature_words',
  'group_top',
  'photos',
  'awards',
  'drama_role',
  'teaser',
];

// id → component lookup used by Wrapped.
export const SLIDE_COMPONENTS = {
  group_overview:  SlideGroupOverview,
  leaderboard:     SlideLeaderboard,
  per_person:      SlidePerPerson,
  signature_words: SlideSignatureWords,
  group_top:       SlideGroupTop,
  photos:          SlidePhotos,
  awards:          SlideAwards,
  drama_role:      SlideDramaRole,
  teaser:          SlideTeaser,
};
