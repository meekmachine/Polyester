import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const sourceRoot = path.join(repoRoot, 'src-cljs', 'latticework');

const forbiddenPatterns = [
  {
    label: 'requestAnimationFrame',
    pattern: /\b(?:js\/)?requestAnimationFrame\b/,
    reason: 'CLJS agencies must not own a render-frame loop.',
  },
  {
    label: 'setInterval',
    pattern: /\b(?:js\/)?setInterval\b/,
    reason: 'CLJS agencies must not introduce interval-based curve evaluators.',
  },
  {
    label: 'AnimationMixer',
    pattern: /\bAnimationMixer\b/,
    reason: 'Loom3/Three owns mixer construction and advancement.',
  },
  {
    label: 'STEP command',
    pattern: /"STEP"|\bSTEP\b|:STEP\b/,
    reason: 'Polyester should emit schedule/control effects, not frame steps.',
  },
  {
    label: 'tick command',
    pattern: /"tick"|\btick\b|:tick\b/,
    reason: 'Tick/update loops belong to the host renderer.',
  },
  {
    label: 'frame update function',
    pattern: /\(defn-?\s+(?:update-frame|advance-frame|step-frame|tick)!?\b/,
    reason: 'Per-frame update helpers should stay out of CLJS agencies.',
  },
];

const requiredRuntimeStrings = [
  '"scheduleSnippet"',
  '"updateSnippet"',
  '"removeSnippet"',
  '"seekSnippet"',
  '"pauseSnippet"',
  '"resumeSnippet"',
  '"setSnippetPlaybackRate"',
  '"setSnippetIntensityScale"',
  '"setSnippetLoopMode"',
  '"setSnippetReverse"',
];

const listCljsFiles = async (dir) => {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) return listCljsFiles(fullPath);
      if (entry.isFile() && entry.name.endsWith('.cljs')) return [fullPath];
      return [];
    }),
  );
  return files.flat().sort();
};

const stripLineComments = (source) =>
  source
    .split('\n')
    .filter((line) => !line.trimStart().startsWith(';;'))
    .join('\n');

const relative = (file) => path.relative(repoRoot, file);

const files = await listCljsFiles(sourceRoot);
const failures = [];

for (const file of files) {
  const source = stripLineComments(await readFile(file, 'utf8'));

  for (const check of forbiddenPatterns) {
    if (check.pattern.test(source)) {
      failures.push(`${relative(file)}: found ${check.label}. ${check.reason}`);
    }
  }
}

const runtimeSource = await readFile(path.join(sourceRoot, 'runtime.cljs'), 'utf8');
for (const value of requiredRuntimeStrings) {
  if (!runtimeSource.includes(value)) {
    failures.push(`src-cljs/latticework/runtime.cljs: missing host control effect ${value}`);
  }
}

if (failures.length > 0) {
  throw new Error(`CLJS mixer boundary check failed:\n${failures.join('\n')}`);
}

console.log(`CLJS mixer boundary passed: ${files.length} source files checked`);
