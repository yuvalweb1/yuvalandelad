import { createElement } from 'react';
import SlideDramaRole from './SlideDramaRole.jsx';
import SlideAwards from './SlideAwards.jsx';
import SlideGroupOverview from './SlideGroupOverview.jsx';
import SlideLeaderboard from './SlideLeaderboard.jsx';
import SlidePerPerson from './SlidePerPerson.jsx';
import SlideSignatureWords from './SlideSignatureWords.jsx';
import SlideGroupTop from './SlideGroupTop.jsx';
import SlidePhotos from './SlidePhotos.jsx';
import SlideVoice from './SlideVoice.jsx';
import SlideVideos from './SlideVideos.jsx';
import SlideStickers from './SlideStickers.jsx';
import SlideAd from './SlideAd.jsx';
import SlideTeaser from './SlideTeaser.jsx';
import SlideMetric, { metricHasData } from './SlideMetric.jsx';
import SlideMetricLeaderboard, { metricHasData as metricLeaderboardHasData } from './SlideMetricLeaderboard.jsx';
import SlideLongestStreak from './SlideLongestStreak.jsx';
import SlideBusiestWeekday from './SlideBusiestWeekday.jsx';
import SlideSignatureEmoji from './SlideSignatureEmoji.jsx';
import SlideReady from './SlideReady.jsx';
import SlideShare from './SlideShare.jsx';
// ── "4 weeks" (month) deck — bite-sized, month-over-month stats ──
import SlideMonthIntro from './month/SlideMonthIntro.jsx';
import SlideMonthOverview from './month/SlideMonthOverview.jsx';
import SlideMonthLeaderboard, { monthLeaderboardHasData } from './month/SlideMonthLeaderboard.jsx';
import SlideMonthAwards from './month/SlideMonthAwards.jsx';
import SlideMonthWeekday from './month/SlideMonthWeekday.jsx';
import SlideMonthHeatmap from './month/SlideMonthHeatmap.jsx';
import SlideMonthVersus, { versusHasData } from './month/SlideMonthVersus.jsx';
import SlideMonthMoment, { momentHasData } from './month/SlideMonthMoment.jsx';
import SlideMonthFact, { factHasData } from './month/SlideMonthFact.jsx';
import SlideMonthClock, { clockHasData } from './month/SlideMonthClock.jsx';
// ── "Season" (90-day) deck — month-by-month story, lightly themed ──
import SlideSeasonIntro from './season/SlideSeasonIntro.jsx';
import SlideSeasonTrend from './season/SlideSeasonTrend.jsx';
import SlideSeasonMovers, { moversHasData } from './season/SlideSeasonMovers.jsx';
import SlideSeasonPersonAward, { personAwardHasData } from './season/SlideSeasonPersonAward.jsx';
import SlideSeasonMonthSpotlight, { monthSpotlightHasData } from './season/SlideSeasonMonthSpotlight.jsx';
import SlideSeasonVerdict, { verdictHasData } from './season/SlideSeasonVerdict.jsx';
import SlideSeasonDuo, { duoHasData } from './season/SlideSeasonDuo.jsx';
import SlideSeasonMoment, { seasonMomentHasData } from './season/SlideSeasonMoment.jsx';
import SlideSeasonMemberMonths, { memberMonthsHasData } from './season/SlideSeasonMemberMonths.jsx';

// Tiny wrapper factory: each metric id renders the shared SlideMetric base
// with a fixed metricKey. Lets the slide registry stay id → component.
// Uses createElement (not JSX) so this file can stay .js.
const metricSlide = (metricKey) => {
  const Wrapped = (props) => createElement(SlideMetric, { ...props, metricKey });
  Wrapped.displayName = `SlideMetric(${metricKey})`;
  return Wrapped;
};

// Leaderboard-style metric slides (used for couple-specific metrics)
const metricLeaderboardSlide = (metricKey) => {
  const Wrapped = (props) => createElement(SlideMetricLeaderboard, { ...props, metricKey });
  Wrapped.displayName = `SlideMetricLeaderboard(${metricKey})`;
  return Wrapped;
};

// Month-deck factories: one shared component, many ids. `metricKey` drives the
// month leaderboards; `cfg` drives the configurable weekday/heatmap/versus/
// moment/fact slides. Mirrors the metricSlide pattern above.
const monthLbSlide = (metricKey) => {
  const W = (props) => createElement(SlideMonthLeaderboard, { ...props, metricKey });
  W.displayName = `SlideMonthLeaderboard(${metricKey})`;
  return W;
};
const cfgSlide = (Comp, cfg, name) => {
  const W = (props) => createElement(Comp, { ...props, cfg });
  W.displayName = `${name}(${cfg})`;
  return W;
};

// id → component lookup used by Wrapped. Every id used in SLIDES_BY_TYPE
// MUST appear here.
export const SLIDE_COMPONENTS = {
  ready:           SlideReady,
  // Original group slides
  group_overview:  SlideGroupOverview,
  leaderboard:     SlideLeaderboard,
  per_person:      SlidePerPerson,
  signature_words: SlideSignatureWords,
  group_top:       SlideGroupTop,
  photos:          SlidePhotos,
  stickers:        SlideStickers,
  voice:           SlideVoice,
  videos:          SlideVideos,
  awards:          SlideAwards,
  drama_role:      SlideDramaRole,
  ad:              SlideAd,
  teaser:          SlideTeaser,
  // New typed slides
  night_owls:          metricLeaderboardSlide('night_owls'),
  early_birds:         metricSlide('early_birds'),
  voice_notes_leader:  metricSlide('voice_notes_leader'),
  overtime:            metricLeaderboardSlide('overtime'),
  response_times:      metricLeaderboardSlide('response_times'),
  essay_writers:       metricSlide('essay_writers'),
  double_texts:        metricLeaderboardSlide('double_texts'),
  ignored_award:       metricLeaderboardSlide('ignored_award'),
  night_messages:      metricLeaderboardSlide('night_messages'),
  messages_sent:          metricLeaderboardSlide('messages_sent'),
  conversation_starters:  metricLeaderboardSlide('conversation_starters'),
  love_you:               metricLeaderboardSlide('love_you'),
  longest_streak:      SlideLongestStreak,
  busiest_weekday:     SlideBusiestWeekday,
  signature_emoji:     SlideSignatureEmoji,
  share:               SlideShare,

  // ── "4 weeks" (month) deck ──
  m4_intro:    SlideMonthIntro,
  m4_overview: SlideMonthOverview,
  m4_awards:   SlideMonthAwards,
  m4_clock:    SlideMonthClock,
  // leaderboards (list template)
  m4_lb_chatterbox:    monthLbSlide('chatterbox'),
  m4_lb_maincharacter: monthLbSlide('maincharacter'),
  m4_lb_supportive:    monthLbSlide('supportive'),
  m4_lb_photographer:  monthLbSlide('photographer'),
  m4_lb_memes:         monthLbSlide('memes'),
  m4_lb_voice:         monthLbSlide('voice'),
  m4_lb_links:         monthLbSlide('links'),
  m4_lb_night:         monthLbSlide('night'),
  m4_lb_speed:         monthLbSlide('speed'),
  m4_lb_starters:      monthLbSlide('starters'),
  m4_lb_comeback:      monthLbSlide('comeback'),
  // weekday bars
  m4_wd_busy:    cfgSlide(SlideMonthWeekday, 'busy', 'SlideMonthWeekday'),
  m4_wd_weekend: cfgSlide(SlideMonthWeekday, 'weekend', 'SlideMonthWeekday'),
  m4_wd_work:    cfgSlide(SlideMonthWeekday, 'work', 'SlideMonthWeekday'),
  // hourly heatmap
  m4_heat_dinner:    cfgSlide(SlideMonthHeatmap, 'dinner', 'SlideMonthHeatmap'),
  m4_heat_peak:      cfgSlide(SlideMonthHeatmap, 'peak', 'SlideMonthHeatmap'),
  m4_heat_latenight: cfgSlide(SlideMonthHeatmap, 'latenight', 'SlideMonthHeatmap'),
  // versus
  m4_vs_work_after:      cfgSlide(SlideMonthVersus, 'work_after', 'SlideMonthVersus'),
  m4_vs_weekday_weekend: cfgSlide(SlideMonthVersus, 'weekday_weekend', 'SlideMonthVersus'),
  m4_vs_gm_gn:           cfgSlide(SlideMonthVersus, 'gm_gn', 'SlideMonthVersus'),
  m4_vs_media_text:      cfgSlide(SlideMonthVersus, 'media_text', 'SlideMonthVersus'),
  m4_vs_voice_text:      cfgSlide(SlideMonthVersus, 'voice_text', 'SlideMonthVersus'),
  m4_vs_night_day:       cfgSlide(SlideMonthVersus, 'night_day', 'SlideMonthVersus'),
  // moments
  m4_mo_biggest_convo: cfgSlide(SlideMonthMoment, 'biggest_convo', 'SlideMonthMoment'),
  m4_mo_chaos10:       cfgSlide(SlideMonthMoment, 'chaos10', 'SlideMonthMoment'),
  m4_mo_spike:         cfgSlide(SlideMonthMoment, 'spike', 'SlideMonthMoment'),
  m4_mo_streak:        cfgSlide(SlideMonthMoment, 'streak', 'SlideMonthMoment'),
  // facts
  m4_fact_emoji: cfgSlide(SlideMonthFact, 'emoji', 'SlideMonthFact'),
  m4_fact_word:  cfgSlide(SlideMonthFact, 'word', 'SlideMonthFact'),

  // ── "Season" (90-day) deck ──
  s3_intro:         SlideSeasonIntro,
  s3_trend:         SlideSeasonTrend,
  s3_member_months: SlideSeasonMemberMonths,
  // movers
  s3_movers_risers:  cfgSlide(SlideSeasonMovers, 'risers', 'SlideSeasonMovers'),
  s3_movers_fallers: cfgSlide(SlideSeasonMovers, 'fallers', 'SlideSeasonMovers'),
  // single-person season awards
  s3_pa_consistent: cfgSlide(SlideSeasonPersonAward, 'consistent', 'SlideSeasonPersonAward'),
  s3_pa_involved:   cfgSlide(SlideSeasonPersonAward, 'involved', 'SlideSeasonPersonAward'),
  s3_pa_new_active: cfgSlide(SlideSeasonPersonAward, 'new_active', 'SlideSeasonPersonAward'),
  // month spotlights
  s3_ms_strongest:     cfgSlide(SlideSeasonMonthSpotlight, 'strongest', 'SlideSeasonMonthSpotlight'),
  s3_ms_quietest:      cfgSlide(SlideSeasonMonthSpotlight, 'quietest', 'SlideSeasonMonthSpotlight'),
  s3_ms_best_vibes:    cfgSlide(SlideSeasonMonthSpotlight, 'best_vibes', 'SlideSeasonMonthSpotlight'),
  s3_ms_affectionate:  cfgSlide(SlideSeasonMonthSpotlight, 'affectionate', 'SlideSeasonMonthSpotlight'),
  s3_ms_collaborative: cfgSlide(SlideSeasonMonthSpotlight, 'collaborative', 'SlideSeasonMonthSpotlight'),
  // trend verdicts
  s3_v_activity:      cfgSlide(SlideSeasonVerdict, 'activity', 'SlideSeasonVerdict'),
  s3_v_earlier_later: cfgSlide(SlideSeasonVerdict, 'earlier_later', 'SlideSeasonVerdict'),
  s3_v_media:         cfgSlide(SlideSeasonVerdict, 'media', 'SlideSeasonVerdict'),
  s3_v_response:      cfgSlide(SlideSeasonVerdict, 'response', 'SlideSeasonVerdict'),
  s3_v_length:        cfgSlide(SlideSeasonVerdict, 'length', 'SlideSeasonVerdict'),
  s3_v_collab:        cfgSlide(SlideSeasonVerdict, 'collab', 'SlideSeasonVerdict'),
  // defining duo
  s3_duo_duo:     cfgSlide(SlideSeasonDuo, 'duo', 'SlideSeasonDuo'),
  s3_duo_rivalry: cfgSlide(SlideSeasonDuo, 'rivalry', 'SlideSeasonDuo'),
  // season moments
  s3_mo_biggest_convo: cfgSlide(SlideSeasonMoment, 'biggest_convo', 'SlideSeasonMoment'),
  s3_mo_longest_convo: cfgSlide(SlideSeasonMoment, 'longest_convo', 'SlideSeasonMoment'),
  s3_mo_weekend:       cfgSlide(SlideSeasonMoment, 'weekend', 'SlideSeasonMoment'),
  s3_mo_media_dump:    cfgSlide(SlideSeasonMoment, 'media_dump', 'SlideSeasonMoment'),
  s3_mo_busiest_day:   cfgSlide(SlideSeasonMoment, 'busiest_day', 'SlideSeasonMoment'),
  s3_mo_chaos:         cfgSlide(SlideSeasonMoment, 'chaos', 'SlideSeasonMoment'),
  s3_mo_streak:        cfgSlide(SlideSeasonMoment, 'streak', 'SlideSeasonMoment'),
};

// Per chat-type ordered lineup. Wrapped filters this further at render time —
// a slide drops out if its data is empty (handled in slideHasData below).
//
// 'other' is the legacy default; do not change without coordinating with copy.
// Media slides (photos/stickers/voice/videos) only render when the export
// actually included media; slideHasData drops them otherwise.
export const SLIDES_BY_TYPE = {
  friends: [
    'ready',
    'group_overview',
    'leaderboard',
    'night_owls',
    'signature_words',
    'group_top',
    'signature_emoji',
    'ignored_award',
    'photos',
    'stickers',
    'voice',
    'videos',
    'awards',
    'drama_role',
    'share',
  ],
  family: [
    'ready',
    'group_overview',
    'early_birds',
    'leaderboard',
    'voice_notes_leader',
    'photos',
    'stickers',
    'voice',
    'videos',
    'per_person',
    'signature_words',
    'group_top',
    'awards',
    'share',
  ],
  work: [
    'ready',
    'group_overview',
    'overtime',
    'response_times',
    'per_person',
    'busiest_weekday',
    'leaderboard',
    'photos',
    'stickers',
    'voice',
    'videos',
    'signature_words',
    'awards',
    'share',
  ],
  couple: [
    'ready',
    'group_overview',
    'messages_sent',
    'per_person',
    'conversation_starters',
    'double_texts',
    'response_times',
    'longest_streak',
    'signature_emoji',
    'signature_words',
    'photos',
    'stickers',
    'voice',
    'videos',
    'night_messages',
    'love_you',
    'awards',
    'share',
  ],
  other: [
    'ready',
    'group_overview',
    'leaderboard',
    'per_person',
    'signature_words',
    'group_top',
    'photos',
    'stickers',
    'voice',
    'videos',
    'awards',
    'drama_role',
    'ad',
    'share',
  ],
};

// Legacy default (consumed by anything still importing SLIDES_DEF).
export const SLIDES_DEF = SLIDES_BY_TYPE.other;

// ── "4 weeks" (month) lineups ────────────────────────────────────────────
// The month window deliberately tells a DIFFERENT story than the year: lighter,
// month-over-month, "what just happened" stats instead of the all-time greats.
// Same filtering rules apply — slideHasData drops anything without data.
export const MONTH_SLIDES_BY_TYPE = {
  family: [
    'm4_intro',
    'm4_overview',
    'm4_lb_chatterbox',
    'm4_lb_supportive',
    'm4_lb_photographer',
    'm4_wd_busy',
    'm4_mo_biggest_convo',
    'm4_heat_dinner',
    'm4_wd_weekend',
    'm4_fact_emoji',
    'm4_fact_word',
    'share',
  ],
  friends: [
    'm4_intro',
    'm4_overview',
    'm4_awards',
    'm4_mo_chaos10',
    'm4_mo_streak',
    'm4_lb_maincharacter',
    'm4_lb_comeback',
    'm4_wd_busy',
    'm4_heat_latenight',
    'm4_fact_emoji',
    'm4_fact_word',
    'share',
  ],
  work: [
    'm4_intro',
    'm4_overview',
    'm4_vs_work_after',
    'm4_wd_work',
    'm4_lb_speed',
    'm4_lb_starters',
    'm4_lb_links',
    'm4_vs_weekday_weekend',
    'm4_fact_word',
    'share',
  ],
  couple: [
    'm4_intro',
    'm4_overview',
    'm4_lb_chatterbox',
    'm4_mo_streak',
    'm4_clock',
    'm4_mo_biggest_convo',
    'm4_lb_speed',
    'm4_lb_photographer',
    'm4_lb_voice',
    'm4_vs_gm_gn',
    'm4_wd_busy',
    'm4_heat_latenight',
    'm4_fact_emoji',
    'share',
  ],
  other: [
    'm4_intro',
    'm4_overview',
    'm4_lb_chatterbox',
    'm4_lb_speed',
    'm4_mo_biggest_convo',
    'm4_heat_peak',
    'm4_lb_photographer',
    'm4_lb_voice',
    'm4_lb_links',
    'm4_mo_spike',
    'm4_fact_emoji',
    'm4_fact_word',
    'share',
  ],
};

// ── "Season" (90-day) lineups ────────────────────────────────────────────
// A 3-month STORY: how the chat evolved month by month, who rose and faded,
// which month had the best vibes, and how it stacks up to the season before.
// Reuses the scope-neutral month leaderboards/versus where they fit. Lightly
// themed (winter/spring/summer/autumn) via a.seasonTheme — cosmetic only.
export const SEASON_SLIDES_BY_TYPE = {
  family: [
    's3_intro', 's3_trend',
    's3_member_months', 's3_movers_risers', 's3_movers_fallers', 's3_pa_consistent', 's3_pa_involved',
    's3_mo_biggest_convo', 's3_mo_weekend', 's3_mo_longest_convo', 's3_mo_media_dump',
    's3_v_activity', 's3_v_earlier_later', 's3_v_media',
    'share',
  ],
  friends: [
    's3_intro', 's3_trend',
    'm4_lb_comeback', 's3_movers_fallers', 'm4_lb_chatterbox', 's3_duo_rivalry',
    's3_mo_busiest_day', 's3_mo_chaos', 's3_mo_weekend',
    'm4_vs_media_text', 'm4_vs_voice_text', 'm4_vs_night_day', 's3_ms_best_vibes',
    'share',
  ],
  work: [
    's3_intro', 's3_trend',
    's3_pa_consistent', 's3_movers_risers', 's3_movers_fallers', 'm4_lb_speed',
    's3_mo_biggest_convo', 's3_ms_collaborative', 's3_ms_quietest', 's3_mo_busiest_day',
    'm4_vs_work_after', 's3_v_collab', 's3_v_length',
    'share',
  ],
  couple: [
    's3_intro', 's3_trend',
    's3_ms_strongest', 's3_ms_quietest', 's3_mo_streak', 's3_ms_affectionate',
    's3_mo_biggest_convo', 'm4_lb_photographer', 's3_mo_longest_convo',
    's3_v_response', 's3_v_earlier_later', 'm4_vs_weekday_weekend',
    'share',
  ],
  other: [
    's3_intro', 's3_trend',
    's3_movers_risers', 's3_movers_fallers', 's3_pa_consistent', 's3_pa_new_active', 's3_pa_involved',
    's3_mo_biggest_convo', 's3_ms_strongest', 's3_mo_media_dump', 's3_mo_busiest_day',
    's3_v_activity', 'm4_vs_media_text', 'm4_vs_night_day',
    'share',
  ],
};

// Pick the deck for a chat type + selected window. The 4-week ('month') and
// 90-day ('season') windows each get their own lineup; every other window keeps
// the all-time deck.
export function getDeck(relationship, period) {
  const key = relationship || 'other';
  if (period === 'month') return MONTH_SLIDES_BY_TYPE[key] || MONTH_SLIDES_BY_TYPE.other;
  if (period === 'season') return SEASON_SLIDES_BY_TYPE[key] || SEASON_SLIDES_BY_TYPE.other;
  return SLIDES_BY_TYPE[key] || SLIDES_BY_TYPE.other;
}

// Per-slide data check. Returns false → Wrapped drops that slide from the deck.
// Keeps slides "verified data only" — never show an empty leaderboard.
export function slideHasData(id, analytics, user) {
  // ── Month deck (m4_*) gating ──
  if (id.startsWith('m4_')) {
    // Always-on framing slides (need only that there are participants).
    if (id === 'm4_intro' || id === 'm4_overview' || id === 'm4_awards') {
      return (analytics.users || []).length > 0;
    }
    if (id === 'm4_clock') return clockHasData(analytics);
    if (id.startsWith('m4_lb_')) return monthLeaderboardHasData(id.slice('m4_lb_'.length), analytics);
    if (id.startsWith('m4_wd_')) return (analytics.groupWeekly || []).some(v => v > 0);
    if (id.startsWith('m4_heat_')) return (analytics.groupHourly || []).some(v => v > 0);
    if (id.startsWith('m4_vs_')) return versusHasData(id.slice('m4_vs_'.length), analytics);
    if (id.startsWith('m4_mo_')) return momentHasData(id.slice('m4_mo_'.length), analytics);
    if (id.startsWith('m4_fact_')) return factHasData(id.slice('m4_fact_'.length), analytics);
    return true;
  }
  // ── Season deck (s3_*) gating ──
  if (id.startsWith('s3_')) {
    if (id === 's3_intro') return (analytics.users || []).length > 0;
    if (id === 's3_trend') return (analytics.season?.months || []).length >= 2;
    if (id === 's3_member_months') return memberMonthsHasData(analytics);
    if (id.startsWith('s3_movers_')) return moversHasData(id.slice('s3_movers_'.length), analytics);
    if (id.startsWith('s3_pa_')) return personAwardHasData(id.slice('s3_pa_'.length), analytics);
    if (id.startsWith('s3_ms_')) return monthSpotlightHasData(id.slice('s3_ms_'.length), analytics);
    if (id.startsWith('s3_v_')) return verdictHasData(id.slice('s3_v_'.length), analytics);
    if (id.startsWith('s3_duo_')) return duoHasData(analytics);
    if (id.startsWith('s3_mo_')) return seasonMomentHasData(id.slice('s3_mo_'.length), analytics);
    return true;
  }
  switch (id) {
    case 'signature_words':
      return analytics.users.some(x => x.topWord);
    case 'group_top':
      return (analytics.topWordsGroup && analytics.topWordsGroup.length > 0)
        || (analytics.topEmojisGroup && analytics.topEmojisGroup.length > 0);
    case 'photos':
      return analytics.photos && analytics.photos.length > 0;
    case 'stickers':
      return analytics.stickers && analytics.stickers.length > 0;
    case 'voice':
      return analytics.voice && analytics.voice.length > 0;
    case 'videos':
      return analytics.videos && analytics.videos.length > 0;
    case 'drama_role':
      return !!user;
    case 'signature_emoji':
      return analytics.users.some(x => x.topEmoji);
    case 'longest_streak':
      return analytics.users.some(x => x.longestStreak >= 2);
    case 'busiest_weekday':
      return (analytics.groupWeekly || []).some(v => v > 0);
    case 'early_birds':
    case 'voice_notes_leader':
    case 'essay_writers':
      return metricHasData(id, analytics);
    case 'night_owls':
    case 'ignored_award':
    case 'overtime':
    case 'response_times':
    case 'double_texts':
    case 'night_messages':
    case 'messages_sent':
    case 'conversation_starters':
    case 'love_you':
      return metricLeaderboardHasData(id, analytics);
    default:
      return true;
  }
}
