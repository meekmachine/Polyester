# Polyester

`@lovelace_lol/polyester` is the ClojureScript worker-backed character-runtime
package for Character Loom agency experiments.

Polyester starts as a fork of Latticework's CLJS staging work. Its purpose is to
let LoomLarge A/B test the CLJS runtime separately from the existing
`@lovelace_lol/latticework` TypeScript package while preserving compatible agency
contracts where practical.

## Status

- Package: `@lovelace_lol/polyester`
- Repo: `meekmachine/Polyester`
- Source fork: `meekmachine/Latticework`
- Initial scope: CLJS npm exports and CLJS worker exports from the Latticework
  CLJS staging branch

## Install

```bash
npm install @lovelace_lol/polyester
```

`three` is an optional peer dependency. Install it in consumers that use
main-thread animation or runtime surfaces backed by Three.js.

```bash
npm install three
```

## Runtime Exports

The CLJS npm bundle is exposed through `./cljs`.

```ts
import {
  createAnimationAgency,
  createBlinkAgency,
  createEyeHeadTrackingAgency,
  createGazeAgency,
  createHairAgency,
  createLipSyncAgency,
  createProsodicAgency,
  createTranscriptionAgency,
  createTTSAgency,
  createConversationAgency,
  createVocalAgency,
} from '@lovelace_lol/polyester/cljs';
```

The CLJS worker bundle is exposed through `./cljs-worker`.

```ts
const worker = new Worker(
  new URL('@lovelace_lol/polyester/cljs-worker', import.meta.url),
  { type: 'module' },
);
```

The current root export still mirrors the inherited Latticework TypeScript
surface while the split is being validated. The long-term direction is for
Polyester to become the CLJS-first agency package and for Latticework to remain
the stable TypeScript package until the migration is complete.

## Current CLJS Agency Coverage

- Animation boundary
- Blink
- Gaze
- Eye/head tracking facade
- Hair
- Lipsync
- Prosodic speech gestures
- TTS planning and Azure timing normalization
- Transcription state and interruption detection
- Conversation turn orchestration
- Vocal timeline planning

Remaining transition work is tracked from the Latticework umbrella issue:
deeper agency parity, worker integration hardening, and an EmotionExpression
agency scaffold.

See [Polyester CLJS Transition Architecture](docs/cljs-transition-architecture.md)
for the detailed current-state inventory, recent CLJS PR summary, remaining
TypeScript compatibility surfaces, and the next runtime stream/Effect boundary
work.

## A/B Testing Strategy

Polyester is intended to be tested from LoomLarge without committing temporary
dependency churn.

Supported paths:

- install a Polyester PR SHA in CI/previews
- install a published `@lovelace_lol/polyester` version
- use npm aliasing if LoomLarge needs to test Polyester behind the existing
  `@lovelace_lol/latticework` dependency name

Example npm alias:

```json
{
  "dependencies": {
    "@lovelace_lol/latticework": "npm:@lovelace_lol/polyester@latest"
  }
}
```

## Development

```bash
npm ci
npm run build
npm run typecheck
npm test
npm run test:cljs
```

The build emits:

- TypeScript ESM/CJS bundles through `tsup`
- CLJS npm ESM bundle through `shadow-cljs`
- CLJS browser worker bundle through `shadow-cljs`
- declaration files for root and CLJS imports

## Release Flow

Publishing mirrors the Latticework tag/release flow. The checked-in
`package.json` version is a baseline only; the publish workflow resolves the
actual release version from an existing `vX.Y.Z` tag or from the latest npm
version, then bumps the patch version in the CI workspace before publishing.

1. Open a PR against `main`.
2. PR checks run build, typecheck, and tests.
3. Merge to `main`.
4. The `Publish Polyester to NPM` workflow determines the next patch version,
   creates or reuses a release tag, builds, tests, and publishes if that npm
   version does not already exist.
5. Verify the published package.

```bash
npm view @lovelace_lol/polyester version gitHead --json
```

The workflow expects the GitHub `npm` environment to provide:

- `NPM_KEY` for npm authentication
- `PUBLISH_PUSH_TOKEN` for pushing release tags

## Notes

Internal namespaces still use the inherited Latticework naming in this initial
fork. That keeps the first repository split small and verifiable. A later cleanup
can rename internals once package publishing and LoomLarge A/B testing are
working.
