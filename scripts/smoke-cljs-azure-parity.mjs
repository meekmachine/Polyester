import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createTTSAgency } from '../dist/cljs/index.js';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');

const corpus = [
  {
    name: 'long-e, f/v, and final th',
    text: 'we feel growth',
    durationMs: 900,
    wordTimings: [
      { word: 'we', start_time: 0.04, end_time: 0.14 },
      { word: 'feel', start_time: 0.18, end_time: 0.42 },
      { word: 'growth', start_time: 0.48, end_time: 0.78 },
    ],
    visemes: [
      { id: 6, audioOffset: 600000 },
      { viseme_id: 18, audio_offset: 0.2 },
      { visemeId: 6, time: 0.3 },
      { viseme_id: 19, audioOffset: 6800000 },
    ],
  },
  {
    name: 'bilabial closures',
    text: 'mom pop baby',
    durationMs: 960,
    wordTimings: [
      { word: 'mom', start: 0.0, end: 0.24 },
      { word: 'pop', start: 0.3, end: 0.55 },
      { word: 'baby', start: 0.6, end: 0.9 },
    ],
    visemes: [
      { viseme_id: 21, audio_offset: 0.03 },
      { viseme_id: 1, audio_offset: 0.16 },
      { viseme_id: 21, audio_offset: 0.32 },
      { viseme_id: 2, audio_offset: 0.46 },
      { viseme_id: 21, audio_offset: 0.62 },
      { viseme_id: 6, audio_offset: 0.78 },
    ],
  },
  {
    name: 's-z and ch-j',
    text: 'sassy church judge',
    durationMs: 1100,
    wordTimings: [
      { word: 'sassy', startSec: 0.0, endSec: 0.34 },
      { word: 'church', startSec: 0.4, endSec: 0.72 },
      { word: 'judge', startSec: 0.78, endSec: 1.04 },
    ],
    visemes: [
      { viseme_id: 15, audio_offset: 0.04 },
      { viseme_id: 1, audio_offset: 0.16 },
      { viseme_id: 15, audio_offset: 0.28 },
      { viseme_id: 16, audio_offset: 0.43 },
      { viseme_id: 4, audio_offset: 0.58 },
      { viseme_id: 16, audio_offset: 0.82 },
    ],
  },
  {
    name: 'r and er',
    text: 'river early',
    durationMs: 820,
    wordTimings: [
      { word: 'river', start_time: 0.02, end_time: 0.38 },
      { word: 'early', start_time: 0.44, end_time: 0.76 },
    ],
    visemes: [
      { viseme_id: 13, audio_offset: 0.04 },
      { viseme_id: 4, audio_offset: 0.15 },
      { viseme_id: 13, audio_offset: 0.29 },
      { viseme_id: 5, audio_offset: 0.47 },
      { viseme_id: 14, audio_offset: 0.63 },
    ],
  },
  {
    name: 'diphthong travel',
    text: 'go cow boy five',
    durationMs: 1300,
    wordTimings: [
      { word: 'go', start_time: 0.0, end_time: 0.22 },
      { word: 'cow', start_time: 0.3, end_time: 0.52 },
      { word: 'boy', start_time: 0.6, end_time: 0.88 },
      { word: 'five', start_time: 0.96, end_time: 1.24 },
    ],
    visemes: [
      { viseme_id: 8, audio_offset: 0.08 },
      { viseme_id: 9, audio_offset: 0.34 },
      { viseme_id: 10, audio_offset: 0.68 },
      { viseme_id: 11, audio_offset: 1.02 },
    ],
  },
  {
    name: 'short-i and rounded ending with visual lead',
    text: 'sit rose',
    durationMs: 820,
    visualLeadMs: 35,
    wordTimings: [
      { word: 'sit', start_time: 0.04, end_time: 0.32 },
      { word: 'rose', start_time: 0.42, end_time: 0.76 },
    ],
    visemes: [
      { viseme_id: 15, audio_offset: 0.06 },
      { viseme_id: 4, audio_offset: 0.17 },
      { viseme_id: 19, audio_offset: 0.27 },
      { viseme_id: 13, audio_offset: 0.45 },
      { viseme_id: 8, audio_offset: 0.58 },
      { viseme_id: 4, audio_offset: 0.72 },
    ],
  },
];

const normalizeTimeline = (timeline) =>
  timeline.map(({ visemeId, offsetMs, durationMs }) => ({
    visemeId,
    offsetMs,
    durationMs,
  }));

const buildTypescriptMapper = async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'polyester-azure-parity-'));
  const outfile = path.join(tempDir, 'azureVisemeMapping.mjs');

  await build({
    entryPoints: [path.join(repoRoot, 'src/lipsync/azureVisemeMapping.ts')],
    outfile,
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node20',
    logLevel: 'silent',
  });

  return {
    tempDir,
    moduleUrl: `${pathToFileURL(outfile).href}?t=${Date.now()}`,
  };
};

const { tempDir, moduleUrl } = await buildTypescriptMapper();

try {
  const { azureVisemesToTimeline } = await import(moduleUrl);

  for (const item of corpus) {
    const visualLeadMs = item.visualLeadMs ?? 0;
    const expected = normalizeTimeline(
      azureVisemesToTimeline(item.visemes, item.durationMs, {
        wordTimings: item.wordTimings,
        visualLeadMs,
      }),
    );
    const tts = createTTSAgency({ azureVisualLeadMs: visualLeadMs }, {});
    const plan = tts.planAzureResponse(item.text, {
      duration: item.durationMs / 1000,
      word_boundaries: item.wordTimings,
      visemes: item.visemes,
    });
    const actual = normalizeTimeline(plan.vocalTimeline.visemes);

    tts.dispose();

    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(
        [
          `Azure parity failed for "${item.name}"`,
          `Expected: ${JSON.stringify(expected)}`,
          `Actual:   ${JSON.stringify(actual)}`,
        ].join('\n'),
      );
    }
  }
} finally {
  await rm(tempDir, { recursive: true, force: true });
}

console.log(`CLJS Azure parity passed: ${corpus.length} phrase timelines`);
