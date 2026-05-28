// Turn the Canva ad still into a real video ad:
//
//   node scripts/make-ad-video.mjs
//
//   [Canva ad, slow zoom-in, 4s]   ← hook + voiceover line 1
//   [live app recording, captions] ← product in motion + voiceover 2-3
//   [Canva ad, slow zoom-out, 3s]  ← CTA (URL already baked into the image)
//
// English voiceover via Windows SAPI (Zira). Output 1080×1920 MP4 with audio.
//
// The Ken-Burns zoom is done with a SINGLE input frame + zoompan d=<frames>
// (NOT -loop 1, which multiplies frames and produced the 9-minute clip in
// the earlier attempt).

import { chromium } from 'playwright';
import ffmpegPath from 'ffmpeg-static';
import { spawnSync } from 'node:child_process';
import {
  existsSync, mkdirSync, readdirSync, rmSync, writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { generateSampleText } from '../src/lib/sample.js';

const ROOT     = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TMP_DIR  = resolve(ROOT, 'play-store/video-tmp');
const AD_PNG   = resolve(ROOT, 'play-store/ad-canva-final.png');
const OUT_PATH = resolve(ROOT, 'play-store/demo.mp4');
const URL      = process.env.RECORD_URL || 'http://yuval.ella.org.il/';

if (!existsSync(AD_PNG)) throw new Error('Missing Canva ad: ' + AD_PNG);
if (existsSync(TMP_DIR)) rmSync(TMP_DIR, { recursive: true, force: true });
mkdirSync(TMP_DIR, { recursive: true });

const W = 540, H = 960, OUT_W = 1080, OUT_H = 1920, FPS = 30;
const ff = (args, label) => {
  const r = spawnSync(ffmpegPath, args, { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`ffmpeg ${label} exit ${r.status}`);
};

// ── 1) Voiceover ────────────────────────────────────────────────────
console.log('1/6  Voiceover (Zira)...');
const voicePath = join(TMP_DIR, 'voice.wav');
const ssml = `
<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
  <prosody rate="0.92">
    Like Spotify Wrapped. <break time="260ms"/> For your group chat.
    <break time="850ms"/>
    Thirteen slides. <break time="180ms"/> Stats. Roasts. Drama.
    <break time="850ms"/>
    Who talks most. <break time="160ms"/> Who ghosts. <break time="160ms"/> Who gets the verdict.
    <break time="850ms"/>
    All on your phone. <break time="160ms"/> Try it free.
  </prosody>
</speak>`;
const psScript = `
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$s.SelectVoice('Microsoft Zira Desktop')
$s.SetOutputToWaveFile('${voicePath.replace(/\\/g, '\\\\')}')
$s.SpeakSsml(@'
${ssml}
'@)
$s.Dispose()
`;
spawnSync('powershell', ['-NoProfile', '-Command', psScript], { stdio: ['ignore', 'inherit', 'inherit'] });
const haveVoice = existsSync(voicePath);
if (!haveVoice) console.warn('  ⚠ no voiceover — continuing silent');

// ── 2) Caption overlays (top of frame) ──────────────────────────────
console.log('2/6  Captions...');
async function caption(text, outFile) {
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${OUT_W}" height="180" viewBox="0 0 ${OUT_W} 180">
  <rect x="60" y="40" width="${OUT_W - 120}" height="110" rx="55" fill="rgba(10,5,15,0.82)" />
  <text x="${OUT_W / 2}" y="115" font-family="Arial, sans-serif" font-size="48"
        font-weight="800" fill="#fff" text-anchor="middle">${text}</text>
</svg>`;
  writeFileSync(outFile, await sharp(Buffer.from(svg)).png().toBuffer());
}
const captions = [
  { text: 'Stats. Roasts. Drama.',       start: 0.3, end: 3.5 },
  { text: 'Who talks most. Who ghosts.', start: 3.5, end: 6.8 },
  { text: 'Who gets roasted.',           start: 6.8, end: 9.8 },
];
for (let i = 0; i < captions.length; i++) await caption(captions[i].text, join(TMP_DIR, `cap-${i}.png`));

// ── 3) Record the app ───────────────────────────────────────────────
console.log('3/6  Recording app...');
const SAMPLE = join(TMP_DIR, 'sample.txt');
writeFileSync(SAMPLE, generateSampleText(), 'utf8');
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: W, height: H }, deviceScaleFactor: 2,
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
for (let i = 0; i < 3; i++) { await page.waitForTimeout(3300); await page.mouse.click(W * 0.75, H * 0.5); }
await page.waitForTimeout(400);
await ctx.close();
await browser.close();
const webm = readdirSync(TMP_DIR).find(f => f.endsWith('.webm'));
if (!webm) throw new Error('no recording');
const webmPath = join(TMP_DIR, webm);

// ── 4) Main clip: trim parsing, scale, overlay captions ─────────────
console.log('4/6  Captioned main clip...');
const mainArgs = ['-y', '-ss', '5', '-t', '10', '-i', webmPath];
captions.forEach((_, i) => mainArgs.push('-i', join(TMP_DIR, `cap-${i}.png`)));
let f = `[0:v]scale=${OUT_W}:${OUT_H}:flags=lanczos,setsar=1[v0]`;
let prev = 'v0';
captions.forEach((c, i) => {
  f += `;[${prev}][${i + 1}:v]overlay=x=(W-w)/2:y=140:enable='between(t,${c.start},${c.end})'[v${i + 1}]`;
  prev = `v${i + 1}`;
});
mainArgs.push('-filter_complex', f, '-map', `[${prev}]`, '-c:v', 'libx264',
  '-preset', 'fast', '-crf', '22', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-an',
  join(TMP_DIR, 'main.mp4'));
ff(mainArgs, 'main');

// ── 5) Canva ad with Ken-Burns zoom (single frame + zoompan d=frames) ─
console.log('5/6  Canva ad intro/outro with zoom...');
function adClip(seconds, outFile, zoomIn) {
  const frames = Math.round(seconds * FPS);
  // zoom ramps 1.00→1.10 (in) or 1.10→1.00 (out). z accumulates because we
  // feed ONE input frame and zoompan iterates d=frames times on it.
  const z = zoomIn
    ? `min(1.0+0.10*on/${frames},1.10)`
    : `max(1.10-0.10*on/${frames},1.0)`;
  ff(['-y', '-i', AD_PNG,
    '-vf', `scale=${OUT_W * 2}:${OUT_H * 2}:flags=lanczos,zoompan=z='${z}':d=${frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${OUT_W}x${OUT_H}:fps=${FPS},setsar=1`,
    '-frames:v', String(frames),
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '22', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-an',
    outFile], 'adclip');
}
adClip(4.0, join(TMP_DIR, 'intro.mp4'), true);
adClip(3.0, join(TMP_DIR, 'outro.mp4'), false);

// ── 6) Concat + mux voiceover ───────────────────────────────────────
console.log('6/6  Concat + audio...');
const list = ['intro.mp4', 'main.mp4', 'outro.mp4']
  .map(x => `file '${join(TMP_DIR, x).replace(/\\/g, '/')}'`).join('\n');
writeFileSync(join(TMP_DIR, 'concat.txt'), list);
ff(['-y', '-f', 'concat', '-safe', '0', '-i', join(TMP_DIR, 'concat.txt'),
  '-c', 'copy', join(TMP_DIR, 'video-only.mp4')], 'concat');

if (haveVoice) {
  ff(['-y', '-i', join(TMP_DIR, 'video-only.mp4'), '-i', voicePath,
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-shortest',
    '-movflags', '+faststart', OUT_PATH], 'mux');
} else {
  ff(['-y', '-i', join(TMP_DIR, 'video-only.mp4'), '-c', 'copy',
    '-movflags', '+faststart', OUT_PATH], 'finalize');
}

console.log('\n✓ Done:', OUT_PATH);
console.log('  1080×1920, ~17s, Canva hook + live app + CTA, English VO.');
