# Polyester CLJS Transition Architecture

This document records the current state of the Polyester rewrite and the
remaining architecture work. It is intentionally explicit because the repository
now contains both inherited TypeScript compatibility code and newer
ClojureScript agency planners.

## Goal

Polyester is intended to become the ClojureScript-first character runtime for
Character Loom. The desired end state is:

- agencies are CLJS data planners/reducers
- agency state is serializable
- agency outputs are plain data events
- worker and in-process runtimes expose the same command/output contract
- browser, backend, Loom3, Three.js, audio, camera, DOM, and LiveKit effects stay
  at the host edge
- LoomLarge can A/B test Polyester against Latticework
- LoomLarge stores app/profile/service state through its Effect-backed state
  layer, with React reading from that source of truth
- observable streams are created from the runtime event/output bus, not from
  scattered service refs or per-component timers

## What Is CLJS Today

The following CLJS namespaces exist under `src-cljs/latticework/`:

| Namespace | Current role |
| --- | --- |
| `animation.cljs` | Serializable animation scheduling gateway and host effect planner. |
| `blink.cljs` | Blink state, AU 43 snippet planning, auto interval calculation, and manual trigger planning. |
| `gaze.cljs` | Worker-safe gaze target planning and snippet output. |
| `eye_head_tracking.cljs` | Eye/head tracking facade that schedules gaze/head snippets without owning camera/browser APIs. |
| `hair.cljs` | Hair style/color/physics state planner and host application outputs. |
| `lipsync.cljs` | Provider viseme normalization, Azure mapping, timing, and debug timeline planning. |
| `vocal.cljs` | Sentence-level mouth timeline planning, jaw curves, coarticulation, drift correction, and cleanup plans. |
| `prosodic.cljs` | Brow/head speech gesture planning, pulses, fade plans, and stop behavior. |
| `tts.cljs` | Text/Azure speech timeline planning, utterance identity, stale callback guards, and commands to Vocal/Prosodic. |
| `transcription.cljs` | Transcript normalization, echo/interruption policy, restart/stop/cleanup recommendations. |
| `conversation.cljs` | Turn-state orchestration and typed commands to TTS, transcription, gaze, blink, prosodic, Vocal, and LipSync. |
| `runtime.cljs` | In-process JS-facing agency constructors and host callback application. |
| `worker.cljs` | Browser worker command dispatch and output posting. |
| `npm.cljs` | ESM export facade for `@lovelace_lol/polyester/cljs`. |
| `protocol.cljs` | Shared output helpers such as `state`, `scheduleSnippet`, `animationEffect`, and `error`. |

The CLJS bundle is exported through:

- `@lovelace_lol/polyester/cljs`
- `@lovelace_lol/polyester/cljs-worker`

The package root export still mirrors the inherited TypeScript/Latticework
surface from `src/index.ts`. That means importing the package root is not the
same thing as using the CLJS runtime.

## What Has Been Landed Recently

### Speech orchestration agencies

PRs #17, #18, and #19 established the first speech-oriented CLJS surface:

- CLJS TTS, transcription, and conversation agencies were added.
- Azure provider timing normalization was smoke-tested against the TypeScript
  Azure mapper.
- TTS utterance identity and stale callback guards were added so late word
  boundaries and playback callbacks cannot mutate a cancelled utterance.

### Transcription policy

PR #20 moved transcription restart and cleanup policy into CLJS data:

- `RESTART`, `STOP`, and `CLEANUP` recommendations are emitted as serializable
  outputs.
- Restart count, pending restart, last recommendation, and error state are part
  of the CLJS snapshot.
- Browser APIs remain host-owned. CLJS decides policy; the host performs effects.

### LipSync and Vocal timing diagnostics

PR #21 added observability for provider speech timing:

- Azure provider id, provider time, visual lead, base canonical id, refined
  canonical id, word context, and segment type travel through CLJS timelines.
- Vocal snippets now expose activation debug data after coarticulation and jaw
  curve generation.
- This lets us inspect whether a bad mouth shape came from provider timing,
  mapping, coarticulation, jaw, or host playback anchoring.

### Conversation command planning

PR #22 hardened CLJS conversation orchestration:

- `autoListen` now gates transcription start commands.
- `useGaze`, `useProsody`, and `useBlink` gate their corresponding commands.
- Interruption, agent end, and conversation stop now stop both Vocal and legacy
  LipSync speech surfaces so stale mouth snippets do not survive the turn.

### Prosodic pulse behavior

PR #23 made prosodic pulse outputs more accurate:

- Configured `pulsePriority` is now applied when pulse snippets restart.
- Pulse events report the actual restarted channels instead of always reporting
  `both`.
- Smoke coverage now verifies odd/even word pulse behavior.

### Blink trigger overrides

PR #24 tightened CLJS blink parity:

- Manual trigger options can override randomness per blink.
- Smoke coverage verifies deterministic manual overrides even when configured
  randomness is nonzero.
- Smoke coverage asserts stable blink snippet metadata: category, priority,
  playback rate, intensity scale, and autoplay.

## Runtime Shape Today

The current CLJS runtime is command/output based:

1. JS calls an agency method or worker client command.
2. CLJS updates an atom-backed agency state.
3. CLJS returns output maps.
4. `runtime.cljs` applies those outputs by calling host callbacks:
   - `onOutput`
   - `onState`
   - `onAgencyCommand`
   - `onAnimationEffect`
   - agency-specific callbacks such as `onTTSEvent` or
     `onTranscriptionRecommendation`

This is already better than hidden service mutation because outputs are
serializable data. It is not yet the final stream architecture.

## What Is Not Done Yet

The main missing piece is a first-class runtime event bus.

Today, outputs are delivered by callbacks. A later PR should expose the same
ordered output data as streams, for example:

- `output$`
- `state$`
- `agencyState$(agencyName)`
- `command$`
- `animationEffect$`
- agency-specific filtered streams

The stream adapter can use `most-subject` at the JS edge so LoomLarge gets a
Most-compatible observable API. The CLJS planner layer should continue emitting
plain data, not JS stream objects.

Effect belongs at the LoomLarge state boundary:

- Polyester emits ordered runtime outputs and state snapshots.
- LoomLarge subscribes once from its service/runtime layer.
- LoomLarge writes profile/app/service state into its Effect-backed store.
- React reads from that Effect-backed source of truth.

This keeps Polyester portable and worker-safe while still supporting the
Most/Effect architecture that LoomLarge needs.

## TypeScript Compatibility That Still Exists

The `src/` tree still contains inherited TypeScript services, machines,
schedulers, RxJS streams, Most subjects, XState machines, tests, and docs. This
is deliberate compatibility scaffolding for the current package root export, but
it should not be confused with the CLJS runtime being complete.

Important examples:

- `src/index.ts` exports the inherited TypeScript service surface.
- `src/animation/animationService.ts` still owns RxJS animation event streams.
- `src/gaze/state.ts`, `src/gaze/transport.ts`, and `src/vocal/state.ts` still
  use `most-subject`.
- `src/eyeHeadTracking/eyeHeadTrackingService.ts` still contains browser/camera
  and RxJS code.
- `src/transcription/transcriptionService.ts` still owns browser transcription
  and microphone effects.

The root package can only be called CLJS-first once the root export is backed by
the CLJS runtime or clearly aliases to it.

## Recommended Next PR

The next architectural PR should add a runtime stream adapter over CLJS outputs.
It should not rewrite all agencies again. It should:

1. Preserve the current CLJS command/output contracts.
2. Create a small JS adapter around `create*Agency` and worker clients.
3. Publish output/state/command streams from one ordered bus.
4. Keep existing host callbacks for compatibility.
5. Add smoke tests proving callback delivery and stream delivery see the same
   ordered outputs.
6. Document how LoomLarge should bridge those streams into its Effect-backed
   profile/app state.

After that, LoomLarge can switch one path at a time from TypeScript services to
the CLJS stream-backed runtime.
