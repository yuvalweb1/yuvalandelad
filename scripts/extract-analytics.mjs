// One-shot extraction helper for Phase 2 (analytics + sample data split).
// Reads src/App.jsx and writes:
//   - src/lib/analytics.js  (STOPWORDS, helpers, computeAll)
//   - src/lib/sample.js     (generateSampleText)
// Safe to delete after Phase 2 lands.
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const appJsxPath = path.join(repoRoot, 'src', 'App.jsx');
const libDir = path.join(repoRoot, 'src', 'lib');

const source = fs.readFileSync(appJsxPath, 'utf8');
const eol = source.includes('\r\n') ? '\r\n' : '\n';
const lines = source.split(/\r?\n/);

function find(predicate, from = 0) {
  for (let i = from; i < lines.length; i++) if (predicate(lines[i], i)) return i;
  return -1;
}

// 1) STOPWORDS opens at `const STOPWORDS = new Set([` and closes at `]);` at column 0.
const stopwordsStart = find((l) => l === 'const STOPWORDS = new Set([');
if (stopwordsStart === -1) throw new Error('STOPWORDS start not found');
const stopwordsEnd = find((l) => l === ']);', stopwordsStart + 1);
if (stopwordsEnd === -1) throw new Error('STOPWORDS end not found');

// 2) computeAll starts at `function computeAll(messages) {` and ends at the next
//    line that is exactly `}` at column 0.
const computeAllStart = find((l) => l === 'function computeAll(messages) {');
if (computeAllStart === -1) throw new Error('computeAll start not found');
const computeAllEnd = find((l) => l === '}', computeAllStart + 1);
if (computeAllEnd === -1) throw new Error('computeAll end not found');

// 3) Helpers live between STOPWORDS' closing line and computeAll's opening line:
//    maxEntry, topNEntries, argmax, argmaxArr, rHash, rPick.
const helpersStart = stopwordsEnd + 1; // line right after `]);`
const helpersEnd = computeAllStart - 1; // line right before `function computeAll`

// 4) generateSampleText
const sampleStart = find((l) => l === 'function generateSampleText() {');
if (sampleStart === -1) throw new Error('generateSampleText start not found');
const sampleEnd = find((l) => l === '}', sampleStart + 1);
if (sampleEnd === -1) throw new Error('generateSampleText end not found');

if (!fs.existsSync(libDir)) fs.mkdirSync(libDir, { recursive: true });

// Build analytics.js: stopwords + helpers + computeAll. Add `export` in front of
// each declaration so downstream code can import them.
const stopwordsLines = lines.slice(stopwordsStart, stopwordsEnd + 1);
stopwordsLines[0] = 'export ' + stopwordsLines[0];

const helperLines = lines.slice(helpersStart, helpersEnd + 1).map((l) => {
  if (l.startsWith('function ')) return 'export ' + l;
  return l;
});

const computeAllLines = lines.slice(computeAllStart, computeAllEnd + 1);
computeAllLines[0] = 'export ' + computeAllLines[0];

const analyticsBody = [
  "import { EMOJI_RE, LINK_RE } from '../parser/index.js';",
  '',
  ...stopwordsLines,
  ...helperLines,
  ...computeAllLines,
  '',
].join(eol);
fs.writeFileSync(path.join(libDir, 'analytics.js'), analyticsBody);
console.log(`wrote src/lib/analytics.js`);

// sample.js
const sampleLines = lines.slice(sampleStart, sampleEnd + 1);
sampleLines[0] = 'export ' + sampleLines[0];
const sampleBody = [
  ...sampleLines,
  '',
].join(eol);
fs.writeFileSync(path.join(libDir, 'sample.js'), sampleBody);
console.log(`wrote src/lib/sample.js`);
