# Animation Agency Mixer Boundary

This note used to describe an in-progress migration back from a legacy
per-frame scheduler. The current Polyester/Latticework boundary is different:
the animation service is already mixer-first, and the CLJS agencies must stay
as planners that emit schedule/control data.

## Current State

- TypeScript `animationService.ts` builds Loom3 clip handles and reads playback
  state from the handle event stream.
- `src-cljs/latticework/animation.cljs` stores snippet metadata and emits
  `scheduleSnippet` plus control effects.
- Other CLJS agencies, including gaze, blink, prosodic, lipsync, and vocal,
  build snippets or control effects as plain maps.
- The CLJS worker dispatches commands and posts ordered output maps. It does
  not own a render loop.
- Loom3/Three owns `AnimationMixer.update(delta)` through the renderer host.

There should be no Polyester CLJS `STEP`, `tick`, `update(delta)`,
`requestAnimationFrame`, or interval-based curve evaluator. Adding one would
recreate the dual-runtime problem where CLJS samples/apply curves while Loom3 is
also advancing mixer actions.

## Ownership

Polyester CLJS owns:

- agency state and behavior decisions
- snippet construction
- schedule and control commands
- cleanup plans and coarse orchestration metadata
- provider normalization, such as Azure viseme timing

Loom3/Three and the host own:

- clip/action construction from snippet curves
- mixer frame advancement
- runtime weights, fades, loop modes, playback rate, reverse playback, and
  completion
- stream events exposed by clip handles
- action cleanup and disposal

## Host Contract

Normal snippet playback should use the host control surface:

- `scheduleSnippet` or `schedule`
- `updateSnippet`
- `removeSnippet`
- `seekSnippet`
- `pauseSnippet`
- `resumeSnippet`
- `setSnippetPlaybackRate`
- `setSnippetIntensityScale`
- `setSnippetLoopMode`
- `setSnippetReverse`

The host implementation should route scheduled snippets into Loom3 clip
construction. Procedural `transitionAU` or `transitionViseme` fallbacks can
remain as legacy/dev compatibility, but they should not be the production path
for CLJS scheduled playback.

## Guardrails

`npm run test:cljs` now runs `scripts/check-cljs-mixer-boundary.mjs` before the
CLJS smoke tests. The boundary check scans CLJS source for frame-loop/runtime
terms and verifies that `runtime.cljs` still exposes the expected host control
effect names.

The smoke test also verifies that the in-process CLJS animation agency forwards
schedule, update, seek, pause, resume, parameter, and global playback operations
to host callbacks. This catches accidental regressions where agency code starts
handling mixer runtime work locally instead of emitting control effects.

## Remaining Work

- Audit the LoomLarge host adapter that receives Polyester CLJS
  `scheduleSnippet` output and confirm it routes to Loom3 clip construction in
  production chat.
- Prefer `vocal.cljs` combined sentence timelines for production lipsync and
  keep `lipsync.cljs` per-word scheduling as compatibility.
- Move prosodic fade plans into mixer-owned handle/weight operations where the
  host supports it. Until then, document timer fallback behavior as temporary
  orchestration code.
- Add coalescing or retarget/update semantics for high-frequency gaze sources
  so repeated gaze target changes do not flood the mixer with short-lived clips.
