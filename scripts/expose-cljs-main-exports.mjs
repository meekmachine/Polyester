import { appendFile, readFile } from 'node:fs/promises';

const exportNames = [
  'createAnimationAgency',
  'createBlinkAgency',
  'createConversationAgency',
  'createEyeHeadTrackingAgency',
  'createGazeAgency',
  'createHairAgency',
  'createLipSyncAgency',
  'createProsodicAgency',
  'createTranscriptionAgency',
  'createTTSAgency',
  'createVocalAgency',
  'createAgencyWorkerClient',
  'createAnimationWorkerClient',
  'createBlinkWorkerClient',
  'createConversationWorkerClient',
  'createEyeHeadTrackingWorkerClient',
  'createGazeWorkerClient',
  'createHairWorkerClient',
  'createLipSyncWorkerClient',
  'createProsodicWorkerClient',
  'createTranscriptionWorkerClient',
  'createTTSWorkerClient',
  'createVocalWorkerClient',
  'installLatticework',
];

async function appendOnce(file, marker, text) {
  const content = await readFile(file, 'utf8');
  if (!content.includes(marker)) {
    await appendFile(file, text);
  }
}

const exportBlock = exportNames.map((name) => `  ${name},`).join('\n');

await appendOnce(
  'dist/index.js',
  "from './cljs/index.js'",
  `\nexport {\n${exportBlock}\n} from './cljs/index.js';\n`,
);

await appendOnce(
  'dist/index.d.ts',
  "from '../types/cljs'",
  `\nexport {\n${exportBlock}\n} from '../types/cljs';\n`,
);

await appendOnce(
  'dist/index.d.cts',
  "from '../types/cljs'",
  `\nexport {\n${exportBlock}\n} from '../types/cljs';\n`,
);

const cjsBlock = exportNames.map((name) => (
  `exports.${name} = function ${name}() {\n` +
  `  throw new Error('${name} is only available from the ESM package entrypoint.');\n` +
  '};'
)).join('\n');

await appendOnce(
  'dist/index.cjs',
  'createBlinkAgency is only available from the ESM package entrypoint',
  `\n${cjsBlock}\n`,
);
