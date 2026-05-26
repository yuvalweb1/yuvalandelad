// ============================================================
// Demo media — synthetic photos / stickers / voice so users can preview
// the media slides without uploading a real chat. Everything is generated
// in-memory (data: URLs, no network). Videos are skipped — a minimal
// playable MP4 isn't trivial to synthesize in JS.
// ============================================================

const svgPhoto = (color, emoji) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="${color}"/><text x="50" y="68" font-size="52" text-anchor="middle">${emoji}</text></svg>`;
const svgSticker = (emoji, stroke) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" fill="#fff" stroke="${stroke}" stroke-width="4"/><text x="50" y="68" font-size="56" text-anchor="middle">${emoji}</text></svg>`;
const dataSvg = (s) => `data:image/svg+xml;utf8,${encodeURIComponent(s)}`;

// Real, playable WAV (mono, 8 kHz, ~`actualSec` of a sine wave at `freq`).
// Kept short (~1.5s) — the `size` we expose to SlideVoice is fake so the
// displayed duration reads as long-form voice notes.
function wavDataUrl(actualSec, freq) {
  const sampleRate = 8000;
  const N = Math.max(1, Math.round(sampleRate * actualSec));
  const buf = new ArrayBuffer(44 + N * 2);
  const dv = new DataView(buf);
  const writeStr = (off, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(off + i, s.charCodeAt(i)); };
  writeStr(0, 'RIFF'); dv.setUint32(4, 36 + N * 2, true); writeStr(8, 'WAVE');
  writeStr(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true);
  dv.setUint16(22, 1, true); dv.setUint32(24, sampleRate, true);
  dv.setUint32(28, sampleRate * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
  writeStr(36, 'data'); dv.setUint32(40, N * 2, true);
  for (let i = 0; i < N; i++) {
    const t = i / sampleRate;
    const env = Math.min(1, Math.min(i, N - i) / 200); // soft fade in/out
    const amp = Math.sin(2 * Math.PI * freq * t) * 0.25 * env * 32767;
    dv.setInt16(44 + i * 2, amp, true);
  }
  const bytes = new Uint8Array(buf);
  let bin = ''; for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return 'data:audio/wav;base64,' + (typeof btoa !== 'undefined' ? btoa(bin) : Buffer.from(bin, 'binary').toString('base64'));
}

/**
 * Synthetic media for the demo flow. Authors mapped from the parsed users.
 * Returns the same shape parseChat returns under `.media`.
 */
export function generateSampleMedia(users) {
  if (!users || users.length === 0) return { photos: [], voice: [], videos: [], stickers: [] };
  const a = (i) => users[i % users.length].author;

  const palette = ['#FFD700', '#FF69B4', '#00BFFF', '#FF8C00', '#8338EC', '#43AA8B', '#F94144', '#577590'];
  const photoEmoji = ['🌴', '🍕', '🎉', '🌅', '🐶', '☕', '🌊', '🎂'];
  const photos = palette.map((color, i) => ({
    name: `IMG-DEMO-${String(i + 1).padStart(2, '0')}.svg`,
    mime: 'image/svg+xml', url: dataSvg(svgPhoto(color, photoEmoji[i])),
    author: a(i), ts: null, size: 1024,
  }));

  const stickerData = [
    { e: '😂', count: 12, stroke: '#FF69B4' },
    { e: '🔥', count: 9,  stroke: '#FF8C00' },
    { e: '💀', count: 7,  stroke: '#4A0E4E' },
    { e: '👀', count: 5,  stroke: '#00BFFF' },
    { e: '😎', count: 4,  stroke: '#FFD700' },
    { e: '🤡', count: 4,  stroke: '#8338EC' },
    { e: '🥹', count: 3,  stroke: '#43AA8B' },
    { e: '💅', count: 3,  stroke: '#FF69B4' },
    { e: '🙃', count: 2,  stroke: '#577590' },
    { e: '🫠', count: 2,  stroke: '#F94144' },
    { e: '✨', count: 2,  stroke: '#FFD700' },
    { e: '🤝', count: 2,  stroke: '#00BFFF' },
    { e: '🤌', count: 1,  stroke: '#FF8C00' },
    { e: '🧠', count: 1,  stroke: '#8338EC' },
    { e: '🎯', count: 1,  stroke: '#4A0E4E' },
  ];
  const stickers = stickerData.map((s, i) => ({
    name: `STK-DEMO-${i + 1}.svg`, mime: 'image/svg+xml',
    url: dataSvg(svgSticker(s.e, s.stroke)),
    author: null, ts: null, size: 512, count: s.count,
  }));

  // SlideVoice computes duration as size / 2000. Fake size → nice durations.
  const voiceClips = [
    { displaySec: 132, freq: 330 },
    { displaySec: 94,  freq: 392 },
    { displaySec: 67,  freq: 440 },
    { displaySec: 47,  freq: 494 },
    { displaySec: 28,  freq: 523 },
    { displaySec: 18,  freq: 587 },
    { displaySec: 12,  freq: 659 },
    { displaySec: 6,   freq: 784 },
  ];
  const voice = voiceClips.map((v, i) => ({
    name: `PTT-DEMO-${i + 1}.wav`, mime: 'audio/wav',
    url: wavDataUrl(1.5, v.freq), // actual playback ~1.5s — fake size below
    author: a(i), ts: null, size: v.displaySec * 2000,
  }));

  return { photos, voice, videos: [], stickers };
}

export function generateSampleText() {
  // Generates a synthetic WhatsApp text with clear bias patterns
  const authors = ['Maya', 'Yoav', 'Noa', 'Daniel', 'Talia'];
  const tplShort = ['חחחחח','lol','😂😂','אש 🔥','אין מצב','כן','ברור','okay','💀','❤️'];
  const tplMid = ['מי בא בערב?','where are we meeting','בואו ניפגש מחר','מה השעה?','איפה אתם?','tomorrow at 8?'];
  const tplLong = [
    'אז חשבתי על כל הסיפור של אתמול והגעתי למסקנה שאולי כדאי שנדבר',
    'I have a whole story to tell you guys about what happened today',
    'אני חייבת לספר לכם משהו מטורף שקרה לי בדרך הבוקר',
  ];
  const tplNight = ['מישהו ער?','cant sleep','אני לא נרדמת','whos up?'];
  const lines = [];
  const start = new Date();
  start.setMonth(start.getMonth() - 3);
  for (let day = 0; day < 90; day++) {
    const date = new Date(start);
    date.setDate(date.getDate() + day);
    const isBurst = Math.random() < 0.08;
    const dailyCount = isBurst ? 60 + Math.floor(Math.random() * 50) : Math.floor(Math.random() * 28) + 8;
    for (let i = 0; i < dailyCount; i++) {
      const r = Math.random();
      let hour;
      if (r < 0.1) hour = Math.floor(Math.random() * 6);
      else if (r < 0.3) hour = 8 + Math.floor(Math.random() * 3);
      else if (r < 0.65) hour = 12 + Math.floor(Math.random() * 6);
      else hour = 18 + Math.floor(Math.random() * 6);
      const minute = Math.floor(Math.random() * 60);
      const author = authors[Math.floor(Math.random() * authors.length)];
      let text;
      const tr = Math.random();
      if (hour < 6) text = tplNight[Math.floor(Math.random() * tplNight.length)];
      else if (tr < 0.55) text = tplShort[Math.floor(Math.random() * tplShort.length)];
      else if (tr < 0.85) text = tplMid[Math.floor(Math.random() * tplMid.length)];
      else text = tplLong[Math.floor(Math.random() * tplLong.length)];
      const d = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
      const t = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      lines.push(`${d}, ${t} - ${author}: ${text}`);
    }
  }
  return lines.join('\n');
}
