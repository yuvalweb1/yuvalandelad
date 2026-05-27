// Build an ad video — version 3.
//
//   node scripts/record-demo.mjs
//
// What changed from v2: stronger opener ("Like Spotify Wrapped. For your
// group chat."), captions moved to the top of the frame so they stop
// covering the app content, Ken Burns slow-zoom on intro/outro so the
// stills aren't static, and an English voiceover generated via Windows
// SAPI (Microsoft Zira) so the ad actually has a voice. No Hebrew TTS is
// installed on this machine — captions+voice are English. Final clip is
// 1080×1920 portrait, ~17s, with audio. Add music in CapCut.

import { chromium } from 'playwright';
import sharp from 'sharp';
import ffmpegPath from 'ffmpeg-static';
import { spawnSync } from 'node:child_process';
import {
  existsSync, mkdirSync, readdirSync, rmSync, writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateSampleText } from '../src/lib/sample.js';

const ROOT     = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TMP_DIR  = resolve(ROOT, 'play-store/video-tmp');
const OUT_PATH = resolve(ROOT, 'play-store/demo.mp4');
const URL      = process.env.RECORD_URL || 'http://yuval.ella.org.il/';

if (existsSync(TMP_DIR)) rmSync(TMP_DIR, { recursive: true, force: true });
mkdirSync(TMP_DIR, { recursive: true });

const W = 540, H = 960;
const OUT_W = 1080, OUT_H = 1920;

// ───────────────────────────────────────────────────────────────────
// Stills — intro and outro
// ───────────────────────────────────────────────────────────────────

async function renderSvgPng(svg, outPath) {
  const buf = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
  writeFileSync(outPath, buf);
  return outPath;
}

// Floating decoration bubbles + diagonal banana→mango→pink wash. Stronger
// blobs than v2 so the still has more presence even before motion.
const bgDecorated = (w, h) => `
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"  stop-color="#FFE45C" />
      <stop offset="40%" stop-color="#FFD700" />
      <stop offset="80%" stop-color="#FF8C00" />
      <stop offset="100%" stop-color="#FF1867" />
    </linearGradient>
    <radialGradient id="orb" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.45)" />
      <stop offset="100%" stop-color="rgba(255,255,255,0)" />
    </radialGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)" />
  <circle cx="${w * 0.82}" cy="${h * 0.15}" r="${w * 0.28}" fill="url(#orb)" />
  <circle cx="${w * 0.18}" cy="${h * 0.78}" r="${w * 0.30}" fill="#FF1867" opacity="0.16" />
  <circle cx="${w * 0.95}" cy="${h * 0.55}" r="${w * 0.18}" fill="#00BFFF" opacity="0.13" />
  <!-- Scattered tiny "spark" dots -->
  ${[
    [0.10, 0.10, 8], [0.30, 0.20, 5], [0.45, 0.05, 6],
    [0.70, 0.35, 7], [0.20, 0.42, 4], [0.85, 0.72, 6],
    [0.35, 0.88, 5], [0.60, 0.92, 7], [0.05, 0.55, 5],
  ].map(([fx, fy, r]) => `<circle cx="${w * fx}" cy="${h * fy}" r="${r}" fill="#fff" opacity="0.7" />`).join('\n')}
`;

console.log('1/6  Generating intro/outro stills...');

await renderSvgPng(`
<svg xmlns="http://www.w3.org/2000/svg" width="${OUT_W}" height="${OUT_H}" viewBox="0 0 ${OUT_W} ${OUT_H}">
  ${bgDecorated(OUT_W, OUT_H)}

  <!-- "Like Spotify Wrapped" — handwritten kicker -->
  <text x="${OUT_W / 2}" y="700" font-family="Georgia, serif" font-style="italic"
        font-size="78" fill="rgba(74,14,78,0.85)" text-anchor="middle">
    Like Spotify Wrapped.
  </text>

  <!-- The punch — three lines so the eye lands on each beat -->
  <text x="${OUT_W / 2}" y="900" font-family="Inter Tight, Inter, Arial, sans-serif"
        font-size="120" font-weight="900" fill="#4A0E4E" text-anchor="middle"
        letter-spacing="-4">For your</text>
  <text x="${OUT_W / 2}" y="1050" font-family="Inter Tight, Inter, Arial, sans-serif"
        font-size="140" font-weight="900" fill="#4A0E4E" text-anchor="middle"
        letter-spacing="-5">group chat.</text>

  <!-- WhatsApp-greenish chip to lock the connection -->
  <rect x="${OUT_W / 2 - 220}" y="1200" width="440" height="100" rx="50"
        fill="#25D366" />
  <text x="${OUT_W / 2}" y="1265" font-family="Inter, Arial, sans-serif"
        font-size="42" font-weight="800" fill="#fff" text-anchor="middle"
        letter-spacing="2">WhatsApp · 13 slides</text>
</svg>`, join(TMP_DIR, 'intro.png'));

await renderSvgPng(`
<svg xmlns="http://www.w3.org/2000/svg" width="${OUT_W}" height="${OUT_H}" viewBox="0 0 ${OUT_W} ${OUT_H}">
  ${bgDecorated(OUT_W, OUT_H)}

  <text x="${OUT_W / 2}" y="780" font-family="Georgia, serif" font-style="italic"
        font-size="70" fill="rgba(74,14,78,0.85)" text-anchor="middle">
    100% on your phone.
  </text>
  <text x="${OUT_W / 2}" y="970" font-family="Inter Tight, Inter, Arial, sans-serif"
        font-size="170" font-weight="900" fill="#4A0E4E" text-anchor="middle"
        letter-spacing="-6">FREE.</text>

  <rect x="${OUT_W / 2 - 420}" y="1130" width="840" height="140" rx="70"
        fill="#4A0E4E" />
  <text x="${OUT_W / 2}" y="1218" font-family="Inter, Arial, sans-serif"
        font-size="48" font-weight="800" fill="#fff" text-anchor="middle"
        letter-spacing="2">yuval.ella.org.il</text>
</svg>`, join(TMP_DIR, 'outro.png'));

// ───────────────────────────────────────────────────────────────────
// Captions — top of frame, English (matches voiceover)
// ───────────────────────────────────────────────────────────────────

async function caption(text, outFile) {
  const w = OUT_W, h = 180;
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect x="60" y="40" width="${w - 120}" height="110" rx="55"
        fill="rgba(10,5,15,0.82)" />
  <text x="${w / 2}" y="115" font-family="Arial, sans-serif"
        font-size="48" font-weight="800" fill="#fff" text-anchor="middle">${text}</text>
</svg>`;
  await renderSvgPng(svg, outFile);
}

// Caption times are RELATIVE to the trimmed main.mp4 (starts after the
// boring parsing screen). The main clip is 10s, split into three caption
// windows that line up with three slide transitions.
console.log('2/6  Generating English caption overlays...');
const captions = [
  { text: 'Stats. Roasts. Drama.',           start: 0.3, end: 3.5 },
  { text: 'Who talks most. Who ghosts.',     start: 3.5, end: 6.8 },
  { text: 'Who gets roasted.',               start: 6.8, end: 9.8 },
];
for (let i = 0; i < captions.length; i++) {
  await caption(captions[i].text, join(TMP_DIR, `cap-${i}.png`));
}

// ───────────────────────────────────────────────────────────────────
// Voiceover via Windows SAPI (Zira)
// ───────────────────────────────────────────────────────────────────

console.log('3/6  Generating voiceover (Microsoft Zira)...');
const voicePath = join(TMP_DIR, 'voice.wav');

// SSML lets us control rate + insert beats between lines so the audio
// pacing matches the visual cuts. We target ~16-17s of speech.
const ssml = `
<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
  <prosody rate="0.92">
    Like Spotify Wrapped. <break time="280ms"/>
    For your group chat.
    <break time="900ms"/>
    Thirteen slides. <break time="200ms"/>
    Stats. Roasts. Drama.
    <break time="900ms"/>
    Who talks most. <break time="200ms"/>
    Who ghosts. <break time="200ms"/>
    Who gets the verdict.
    <break time="900ms"/>
    All on your phone. <break time="200ms"/>
    Try it free.
  </prosody>
</speak>`;

const ps = `
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$s.SelectVoice('Microsoft Zira Desktop')
$s.SetOutputToWaveFile('${voicePath.replace(/\\/g, '\\\\')}')
$s.SpeakSsml(@'
${ssml}
'@)
$s.Dispose()
`;
const tts = spawnSync('powershell', ['-NoProfile', '-Command', ps], {
  stdio: ['ignore', 'inherit', 'inherit'],
});
if (tts.status !== 0 || !existsSync(voicePath)) {
  console.warn('  ⚠ TTS failed — continuing without audio.');
}

// ───────────────────────────────────────────────────────────────────
// Record the app
// ───────────────────────────────────────────────────────────────────

const SAMPLE = join(TMP_DIR, 'sample-chat.txt');
writeFileSync(SAMPLE, generateSampleText(), 'utf8');

console.log('4/6  Recording app flow...');
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: W, height: H },
  deviceScaleFactor: 2,
  isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  recordVideo: { dir: TMP_DIR, size: { width: W, height: H } },
});
await ctx.addInitScript(() => {
  localStorage.setItem('cw_seen_guide', '1');
  localStorage.setItem('cw_premium_promo_dismissed', String(Date.now()));
});
const page = await ctx.newPage();

await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(600);
await page.locator('input[type="file"]').first().setInputFiles(SAMPLE);
try {
  await page.getByText(/^Skip$/i).first().waitFor({ timeout: 15000 });
  await page.getByText(/^Skip$/i).first().click();
} catch {}

// Click through 3 slides at ~3.3s each — about 10s of slide content.
for (let i = 0; i < 3; i++) {
  await page.waitForTimeout(3300);
  await page.mouse.click(W * 0.75, H * 0.5);
}
await page.waitForTimeout(500);

await ctx.close();
await browser.close();

const webm = readdirSync(TMP_DIR).find(f => f.endsWith('.webm'));
if (!webm) throw new Error('No .webm produced');
const webmPath = join(TMP_DIR, webm);

// ───────────────────────────────────────────────────────────────────
// ffmpeg composite
// ───────────────────────────────────────────────────────────────────

const INTRO_S = 3.5;
const OUTRO_S = 3.0;

console.log('5/6  Building captioned main clip...');

// Trim the recording: skip the first 5s (parsing screen + onboarding skip)
// and keep only 10s of actual Wrapped slides. Captions sit at TOP of frame
// (y=140) so they stop covering the slide.
const MAIN_START = 5;
const MAIN_DUR   = 10;
const capArgs = ['-y', '-ss', String(MAIN_START), '-t', String(MAIN_DUR), '-i', webmPath];
captions.forEach((_, i) => capArgs.push('-i', join(TMP_DIR, `cap-${i}.png`)));
let filter = `[0:v]scale=${OUT_W}:${OUT_H}:flags=lanczos,setsar=1[v0]`;
let prev = 'v0';
captions.forEach((c, i) => {
  const lbl = `v${i + 1}`;
  filter += `;[${prev}][${i + 1}:v]overlay=x=(W-w)/2:y=140:enable='between(t,${c.start},${c.end})'[${lbl}]`;
  prev = lbl;
});
capArgs.push('-filter_complex', filter, '-map', `[${prev}]`,
  '-c:v', 'libx264', '-preset', 'fast', '-crf', '22',
  '-pix_fmt', 'yuv420p', '-r', '30', '-an',
  join(TMP_DIR, 'main.mp4'));
if (spawnSync(ffmpegPath, capArgs, { stdio: 'inherit' }).status !== 0)
  throw new Error('ffmpeg main failed');

console.log('     Building intro/outro stills with fade...');

// Simple still clip with a tiny fade-in/out so it doesn't feel jarring.
// Fancy Ken-Burns motion turned out to mis-multiply frames with looped
// input; static + fade is reliable and looks fine paired with the
// voiceover and the live recording in between.
function still(pngPath, seconds, outFile, fadeIn = false, fadeOut = false) {
  const fades = [];
  if (fadeIn)  fades.push(`fade=t=in:st=0:d=0.4`);
  if (fadeOut) fades.push(`fade=t=out:st=${(seconds - 0.4).toFixed(2)}:d=0.4`);
  const vf = [`scale=${OUT_W}:${OUT_H}:flags=lanczos`, ...fades, 'setsar=1'].join(',');
  const args = ['-y', '-loop', '1', '-t', String(seconds), '-i', pngPath,
    '-vf', vf,
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '22',
    '-pix_fmt', 'yuv420p', '-r', '30', '-an', outFile];
  if (spawnSync(ffmpegPath, args, { stdio: 'inherit' }).status !== 0)
    throw new Error('ffmpeg still failed');
}
still(join(TMP_DIR, 'intro.png'), INTRO_S, join(TMP_DIR, 'intro.mp4'), true,  false);
still(join(TMP_DIR, 'outro.png'), OUTRO_S, join(TMP_DIR, 'outro.mp4'), true,  true );

console.log('6/6  Concatenating + mixing voiceover...');
const concatList = ['intro.mp4', 'main.mp4', 'outro.mp4']
  .map(f => `file '${join(TMP_DIR, f).replace(/\\/g, '/')}'`).join('\n');
writeFileSync(join(TMP_DIR, 'concat.txt'), concatList);

// Concat the three clips into a single video-only MP4.
if (spawnSync(ffmpegPath, ['-y', '-f', 'concat', '-safe', '0',
  '-i', join(TMP_DIR, 'concat.txt'),
  '-c', 'copy', join(TMP_DIR, 'video-only.mp4')], { stdio: 'inherit' }).status !== 0)
  throw new Error('ffmpeg concat failed');

// Mix in the voiceover (start at t=0 since intro begins immediately).
const finalArgs = existsSync(voicePath) ? [
  '-y',
  '-i', join(TMP_DIR, 'video-only.mp4'),
  '-i', voicePath,
  '-c:v', 'copy',
  '-c:a', 'aac', '-b:a', '160k',
  '-shortest',
  '-movflags', '+faststart',
  OUT_PATH,
] : [
  '-y',
  '-i', join(TMP_DIR, 'video-only.mp4'),
  '-c', 'copy',
  '-movflags', '+faststart',
  OUT_PATH,
];
if (spawnSync(ffmpegPath, finalArgs, { stdio: 'inherit' }).status !== 0)
  throw new Error('ffmpeg final failed');

console.log('\n✓ Done.');
console.log('  Video:', OUT_PATH);
console.log(`  Spec:  ${OUT_W}×${OUT_H}, ~${INTRO_S + 10 + OUTRO_S}s, English voiceover (Zira)`);
console.log('  Add music: open in CapCut on iPhone, drop a track on top.');
