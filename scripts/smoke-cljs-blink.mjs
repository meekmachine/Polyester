import {
  createAnimationAgency,
  createBlinkAgency,
  createConversationAgency,
  createEyeHeadTrackingAgency,
  createGazeAgency,
  createHairAgency,
  createLipSyncAgency,
  createProsodicAgency,
  createTranscriptionAgency,
  createTTSAgency,
  createVocalAgency,
} from '../dist/cljs/index.js';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const scheduled = [];
const states = [];

const agency = createBlinkAgency(
  { duration: 0.05, intensity: 0.5, randomness: 0, frequency: 60 },
  {
    scheduleSnippet(snippet, opts) {
      scheduled.push({ snippet, opts });
      return snippet.name;
    },
    onState(state) {
      states.push(state);
    },
  },
);

agency.triggerBlink();
const state = agency.getState();

if (scheduled.length !== 1) {
  throw new Error(`Expected one scheduled blink, received ${scheduled.length}`);
}

const [{ snippet, opts }] = scheduled;
const curve = snippet.curves?.['43'];

if (!Array.isArray(curve) || curve.length !== 7) {
  throw new Error(`Expected AU 43 curve with seven points, received ${curve?.length ?? 'none'}`);
}

if (snippet.snippetCategory !== 'blink' ||
    snippet.snippetPriority !== 100 ||
    snippet.snippetPlaybackRate !== 1.0 ||
    snippet.snippetIntensityScale !== 1.0) {
  throw new Error(`Expected blink snippet metadata to stay stable, received ${JSON.stringify(snippet)}`);
}

if (opts?.autoPlay !== true) {
  throw new Error('Expected blink snippet to request autoPlay');
}

if (state.scheduledBlinkCount !== 1) {
  throw new Error(`Expected scheduledBlinkCount to be 1, received ${state.scheduledBlinkCount}`);
}

agency.setRandomness(1);
agency.triggerBlink({ intensity: 0.4, duration: 0.2, randomness: 0 });

const overrideCurve = scheduled[1].snippet.curves?.['43'];
if (scheduled[1].snippet.maxTime !== 0.2 || overrideCurve?.[2]?.intensity !== 0.4) {
  throw new Error(`Expected per-trigger blink overrides to ignore configured randomness, received ${JSON.stringify(scheduled[1])}`);
}

const manualScheduledCount = scheduled.length;
agency.setRandomness(0);
agency.enable();
await wait(1100);

if (scheduled.length <= manualScheduledCount) {
  throw new Error(`Expected automatic blink after enable, received ${scheduled.length} scheduled snippets`);
}

const scheduledAfterAuto = scheduled.length;
agency.disable();
await wait(1100);

if (scheduled.length !== scheduledAfterAuto) {
  throw new Error(`Expected automatic blink timer to stop after disable, received ${scheduled.length - scheduledAfterAuto} extra snippets`);
}

if (states.length < 5) {
  throw new Error(`Expected initial, manual, enable, automatic, and disable state callbacks, received ${states.length}`);
}

agency.dispose();

const animationScheduled = [];
const animationRemoved = [];
const animationEffects = [];
const animationEvents = [];
const animationStates = [];

const animation = createAnimationAgency(
  undefined,
  {
    scheduleSnippet(snippet, opts) {
      animationScheduled.push({ snippet, opts });
      return snippet.name;
    },
    updateSnippet(snippet) {
      animationEffects.push({ op: 'hostUpdateSnippet', snippet });
      return snippet.name;
    },
    removeSnippet(name) {
      animationRemoved.push(name);
    },
    seekSnippet(name, offsetSec) {
      animationEffects.push({ op: 'hostSeekSnippet', name, offsetSec });
    },
    pauseSnippet(name) {
      animationEffects.push({ op: 'hostPauseSnippet', name });
    },
    resumeSnippet(name) {
      animationEffects.push({ op: 'hostResumeSnippet', name });
    },
    play() {
      animationEffects.push({ op: 'hostPlayAll' });
    },
    pause() {
      animationEffects.push({ op: 'hostPauseAll' });
    },
    stop() {
      animationEffects.push({ op: 'hostStopAll' });
    },
    setSnippetPlaybackRate(name, rate) {
      animationEffects.push({ op: 'hostSetRate', name, rate });
    },
    setSnippetIntensityScale(name, scale) {
      animationEffects.push({ op: 'hostSetScale', name, scale });
    },
    onAnimationEffect(effect) {
      animationEffects.push(effect);
    },
    onAnimationEvent(event) {
      animationEvents.push(event);
    },
    onState(state) {
      if (state?.globalPlaybackState) {
        animationStates.push(state);
      }
    },
  },
);

const animationName = animation.schedule(
  {
    name: 'cljs_smile',
    snippetCategory: 'auSnippet',
    curves: {
      12: [
        { time: 0, intensity: 0 },
        { time: 0.2, intensity: 0.75 },
      ],
    },
  },
  { autoPlay: true, priority: 42, offsetSec: 0.05 },
);

if (animationName !== 'cljs_smile') {
  throw new Error(`Expected scheduled animation name, received ${animationName}`);
}

if (animationScheduled.length !== 1 || animationScheduled[0].opts?.autoPlay !== true) {
  throw new Error(`Expected animation host schedule, received ${JSON.stringify(animationScheduled)}`);
}

let animationState = animation.getState();
const normalizedAnimation = animationState.snippets.cljs_smile;
if (!normalizedAnimation?.isPlaying || normalizedAnimation.duration !== 0.2 || normalizedAnimation.snippetPriority !== 42) {
  throw new Error(`Unexpected normalized animation state: ${JSON.stringify(normalizedAnimation)}`);
}

animation.setSnippetPlaybackRate('cljs_smile', 1.5);
animation.setSnippetIntensityScale('cljs_smile', 0.4);
animation.seek('cljs_smile', 0.1);
animation.pause();
animation.play();

const scheduleSnapshot = animation.getScheduleSnapshot();
if (scheduleSnapshot[0]?.name !== 'cljs_smile' || scheduleSnapshot[0]?.offset !== 0.1) {
  throw new Error(`Unexpected animation schedule snapshot: ${JSON.stringify(scheduleSnapshot)}`);
}

animation.updateSnippet({
  name: 'cljs_smile',
  curves: {
    12: [
      { time: 0, intensity: 0.1 },
      { time: 0.3, intensity: 0.9 },
    ],
  },
});

animationState = animation.getState();
if (animationState.snippets.cljs_smile.duration !== 0.3) {
  throw new Error(`Expected animation update to recalculate duration, received ${animationState.snippets.cljs_smile.duration}`);
}

animation.remove('cljs_smile');
if (!animationRemoved.includes('cljs_smile')) {
  throw new Error('Expected animation remove to hit host removeSnippet');
}

if (animation.getState().order.length !== 0) {
  throw new Error(`Expected animation registry to be empty after remove: ${JSON.stringify(animation.getState())}`);
}

if (!animationEvents.some((event) => event.type === 'GLOBAL_PLAYBACK_CHANGED' && event.state === 'playing')) {
  throw new Error(`Expected animation play event, saw ${JSON.stringify(animationEvents)}`);
}

if (animationStates.length < 8) {
  throw new Error(`Expected animation state callbacks, received ${animationStates.length}`);
}

animation.dispose();

const gazeScheduled = [];
const gazeRemoved = [];
const gazeStates = [];

const gaze = createGazeAgency(
  { smoothFactor: 1, minDelta: 0, duration: 200, headRoll: 0.25 },
  {
    scheduleSnippet(snippet, opts) {
      gazeScheduled.push({ snippet, opts });
      return snippet.name;
    },
    removeSnippet(name) {
      gazeRemoved.push(name);
    },
    onState(state) {
      gazeStates.push(state);
    },
  },
);

const gazeResult = gaze.schedule({ x: 0.5, y: -0.25, z: 0 });

if (gazeResult !== true) {
  throw new Error('Expected CLJS gaze schedule to report a scheduled animation');
}

if (gazeScheduled.length !== 5) {
  throw new Error(`Expected five gaze snippets, received ${gazeScheduled.length}`);
}

const expectedGazeNames = [
  'eyeHeadTracking/eyeYaw',
  'eyeHeadTracking/eyePitch',
  'eyeHeadTracking/headYaw',
  'eyeHeadTracking/headPitch',
  'eyeHeadTracking/headRoll',
];

for (const name of expectedGazeNames) {
  if (!gazeScheduled.some((entry) => entry.snippet.name === name)) {
    throw new Error(`Expected gaze snippet ${name}`);
  }

  if (!gazeRemoved.includes(name)) {
    throw new Error(`Expected existing gaze snippet ${name} to be removed before scheduling`);
  }
}

for (const { snippet: gazeSnippet, opts: gazeOpts } of gazeScheduled) {
  if (gazeOpts?.autoPlay !== true) {
    throw new Error(`Expected ${gazeSnippet.name} to request autoPlay`);
  }

  for (const curve of Object.values(gazeSnippet.curves ?? {})) {
    if (!Array.isArray(curve) || curve.length !== 2) {
      throw new Error(`Expected ${gazeSnippet.name} curves to have inherited start and target keyframes`);
    }
    if (curve[0]?.inherit !== true) {
      throw new Error(`Expected ${gazeSnippet.name} first keyframe to inherit live pose`);
    }
  }
}

const gazeState = gaze.getState();
if (
  gazeState.scheduledGazeCount !== 1 ||
  Math.abs(gazeState.current.x - 0.35) > 0.000001 ||
  Math.abs(gazeState.current.y - -0.175) > 0.000001
) {
  throw new Error(`Unexpected CLJS gaze state: ${JSON.stringify(gazeState)}`);
}

gaze.resetToNeutral(100);
const centered = gaze.getState();
if (centered.current.x !== 0 || centered.current.y !== 0) {
  throw new Error(`Expected resetToNeutral to schedule center gaze, received ${JSON.stringify(centered.current)}`);
}

gaze.stop();
if (gazeRemoved.length < 10) {
  throw new Error(`Expected gaze stop to remove all tracking snippets, saw ${gazeRemoved.length} removals`);
}

if (gazeStates.length < 4) {
  throw new Error(`Expected initial, schedule, reset, and stop gaze states, received ${gazeStates.length}`);
}

gaze.dispose();

const eyeHeadScheduled = [];
const eyeHeadRemoved = [];
const eyeHeadEffects = [];
const eyeHeadStates = [];

const eyeHead = createEyeHeadTrackingAgency(
  {
    eyeTrackingEnabled: true,
    headTrackingEnabled: true,
    headFollowEyes: true,
    agencyTransitionDuration: 180,
    eyeIntensity: 1.0,
    headIntensity: 0.5,
  },
  {
    scheduleSnippet(snippet, opts) {
      eyeHeadScheduled.push({ snippet, opts });
      return snippet.name;
    },
    removeSnippet(name) {
      eyeHeadRemoved.push(name);
    },
    pauseSnippet(name) {
      eyeHeadEffects.push({ op: 'pause', name });
    },
    resumeSnippet(name) {
      eyeHeadEffects.push({ op: 'resume', name });
    },
    onAnimationEffect(effect) {
      eyeHeadEffects.push(effect);
    },
    onState(state) {
      if (state?.currentGaze && state?.targetGaze) {
        eyeHeadStates.push(state);
      }
    },
  },
);

eyeHead.setMode('manual');
const eyeHeadScheduledTarget = eyeHead.setGazeTarget({ x: 0.4, y: 0.2, z: 0 });
if (eyeHeadScheduledTarget !== true) {
  throw new Error('Expected CLJS eye/head tracking target to schedule snippets');
}

for (const name of [
  'eyeHeadTracking/eyeYaw',
  'eyeHeadTracking/eyePitch',
  'eyeHeadTracking/headYaw',
  'eyeHeadTracking/headPitch',
  'eyeHeadTracking/headRoll',
]) {
  const scheduledEntry = eyeHeadScheduled.find((entry) => entry.snippet.name === name);
  if (!scheduledEntry) {
    throw new Error(`Expected CLJS eye/head tracking snippet ${name}`);
  }
  if (scheduledEntry.opts?.autoPlay !== true) {
    throw new Error(`Expected CLJS eye/head tracking snippet ${name} to autoPlay`);
  }
  for (const curve of Object.values(scheduledEntry.snippet.curves ?? {})) {
    if (curve[0]?.inherit !== true) {
      throw new Error(`Expected CLJS eye/head tracking inherited first keyframe for ${name}`);
    }
  }
}

let eyeHeadState = eyeHead.getState();
if (eyeHeadState.eyeStatus !== 'tracking' || eyeHeadState.headStatus !== 'tracking') {
  throw new Error(`Expected CLJS eye/head tracking state to be tracking, received ${JSON.stringify(eyeHeadState)}`);
}

eyeHead.pause();
eyeHead.resume();
if (!eyeHeadEffects.some((effect) => effect.op === 'pause') || !eyeHeadEffects.some((effect) => effect.op === 'resume')) {
  throw new Error(`Expected CLJS eye/head tracking pause/resume effects, received ${JSON.stringify(eyeHeadEffects)}`);
}

eyeHead.resetToNeutral(120);
eyeHeadState = eyeHead.getState();
if (eyeHeadState.currentGaze.x !== 0 || eyeHeadState.currentGaze.y !== 0) {
  throw new Error(`Expected CLJS eye/head tracking resetToNeutral to center gaze, received ${JSON.stringify(eyeHeadState.currentGaze)}`);
}

eyeHead.stop();
if (eyeHeadRemoved.length < 10) {
  throw new Error(`Expected CLJS eye/head tracking stop to remove tracking snippets, saw ${eyeHeadRemoved.length}`);
}

if (eyeHeadStates.length < 4) {
  throw new Error(`Expected CLJS eye/head tracking state callbacks, received ${eyeHeadStates.length}`);
}

eyeHead.dispose();

const prosodicScheduled = [];
const prosodicRemoved = [];
const prosodicEvents = [];
const prosodicFadePlans = [];
const prosodicStates = [];

const prosodic = createProsodicAgency(
  { fadeSteps: 3, fadeStepInterval: 40, defaultIntensity: 0.6, pulsePriority: 7 },
  {
    scheduleSnippet(snippet, opts) {
      prosodicScheduled.push({ snippet, opts });
      return snippet.name;
    },
    removeSnippet(name) {
      prosodicRemoved.push(name);
    },
    onProsodicEvent(event) {
      prosodicEvents.push(event);
    },
    onProsodicFadePlan(plan) {
      prosodicFadePlans.push(plan);
    },
    onState(state) {
      if (state?.status) {
        prosodicStates.push(state);
      }
    },
  },
);

prosodic.loadBrow({
  name: 'brow_small',
  curves: {
    1: [
      { time: 0, intensity: 0 },
      { time: 0.1, intensity: 50 },
    ],
  },
});
prosodic.loadHead({
  name: 'head_small',
  curves: {
    53: [
      { time: 0, intensity: 0 },
      { time: 0.2, intensity: 0.4 },
    ],
  },
});

prosodic.startTalking();

if (prosodicScheduled.length !== 2) {
  throw new Error(`Expected prosodic start to schedule brow and head, received ${prosodicScheduled.length}`);
}

if (prosodicScheduled[0].snippet.curves['1']?.[1]?.intensity !== 0.5) {
  throw new Error(`Expected prosodic CLJS to normalize 0-100 intensities, saw ${JSON.stringify(prosodicScheduled[0])}`);
}

let prosodicState = prosodic.getState();
if (prosodicState.browStatus !== 'active' || prosodicState.headStatus !== 'active') {
  throw new Error(`Expected active prosodic state, received ${JSON.stringify(prosodicState)}`);
}

prosodic.pulse(1);
if (!prosodicRemoved.includes('brow_small') || !prosodicRemoved.includes('head_small')) {
  throw new Error(`Expected odd prosodic pulse to restart brow and head, removed ${prosodicRemoved.join(', ')}`);
}

const oddPulseScheduled = prosodicScheduled.slice(2, 4);
if (oddPulseScheduled.length !== 2 || !oddPulseScheduled.every((entry) => entry.snippet.snippetPriority === 7)) {
  throw new Error(`Expected odd prosodic pulse to use pulse priority, received ${JSON.stringify(oddPulseScheduled)}`);
}

prosodic.pulse(2);
const browRestartCount = prosodicRemoved.filter((name) => name === 'brow_small').length;
const headRestartCount = prosodicRemoved.filter((name) => name === 'head_small').length;
if (browRestartCount !== 2 || headRestartCount !== 1 || prosodicScheduled.at(-1)?.snippet.name !== 'brow_small') {
  throw new Error(`Expected even prosodic pulse to restart brow only, scheduled=${JSON.stringify(prosodicScheduled.at(-1))}, removed=${prosodicRemoved.join(', ')}`);
}

prosodic.stopTalking();
prosodicState = prosodic.getState();
if (prosodicState.browStatus !== 'stopping' || prosodicState.headStatus !== 'stopping') {
  throw new Error(`Expected stopping prosodic state after stopTalking, received ${JSON.stringify(prosodicState)}`);
}

if (prosodicFadePlans[0]?.steps?.length !== 6) {
  throw new Error(`Expected 3 fade steps for brow and head, received ${JSON.stringify(prosodicFadePlans)}`);
}

prosodic.stop();
if (prosodic.getState().isLooping !== false) {
  throw new Error('Expected prosodic stop to clear looping state');
}

if (!prosodicEvents.some((event) => event.type === 'PULSE' && event.wordIndex === 1 && event.channel === 'both') ||
    !prosodicEvents.some((event) => event.type === 'PULSE' && event.wordIndex === 2 && event.channel === 'brow')) {
  throw new Error(`Expected prosodic pulse event, received ${JSON.stringify(prosodicEvents)}`);
}

if (prosodicStates.length < 6) {
  throw new Error(`Expected prosodic state callbacks, received ${prosodicStates.length}`);
}

prosodic.dispose();

const vocalScheduled = [];
const vocalRemoved = [];
const vocalEffects = [];
const vocalEvents = [];
const vocalCleanupPlans = [];
const vocalStates = [];

const vocal = createVocalAgency(
  { intensity: 1.2, jawScale: 1.1 },
  {
    scheduleSnippet(snippet, opts) {
      vocalScheduled.push({ snippet, opts });
      return snippet.name;
    },
    removeSnippet(name) {
      vocalRemoved.push(name);
    },
    seekSnippet(name, offsetSec) {
      vocalEffects.push({ op: 'seek', name, offsetSec });
    },
    pauseSnippet(name) {
      vocalEffects.push({ op: 'pause', name });
    },
    resumeSnippet(name) {
      vocalEffects.push({ op: 'resume', name });
    },
    onVocalEvent(event) {
      vocalEvents.push(event);
    },
    onVocalCleanupPlan(plan) {
      vocalCleanupPlans.push(plan);
    },
    onState(state) {
      if (state?.config?.priority === 50 && Array.isArray(state?.activeSnippets)) {
        vocalStates.push(state);
      }
    },
  },
);

const vocalName = vocal.startSentence('hello world');
if (!vocalName?.startsWith('vocal_hello_world_')) {
  throw new Error(`Expected vocal sentence name, received ${vocalName}`);
}

if (vocalScheduled.length !== 1) {
  throw new Error(`Expected vocal sentence to schedule one snippet, received ${vocalScheduled.length}`);
}

const vocalSnippet = vocalScheduled[0].snippet;
if (vocalSnippet.snippetCategory !== 'combined' || vocalSnippet.autoVisemeJaw !== false) {
  throw new Error(`Expected combined vocal snippet with explicit jaw, received ${JSON.stringify(vocalSnippet)}`);
}

if (!vocalSnippet.curves?.['26']?.length) {
  throw new Error(`Expected CLJS vocal planner to emit AU26 jaw curve, received ${JSON.stringify(vocalSnippet.curves)}`);
}

if (vocalScheduled[0].opts?.autoPlay !== true) {
  throw new Error('Expected CLJS vocal snippet to request autoPlay');
}

let vocalState = vocal.getState();
if (vocalState.isSpeaking !== true || vocalState.snippetName !== vocalName) {
  throw new Error(`Expected active vocal state, received ${JSON.stringify(vocalState)}`);
}

vocal.onWordBoundary('hello', 0, 0.25);
if (!vocalEffects.some((effect) => effect.op === 'seek' && effect.name === vocalName && effect.offsetSec === 0.25)) {
  throw new Error(`Expected vocal drift correction seek, received ${JSON.stringify(vocalEffects)}`);
}

vocal.pauseSentence();
vocal.resumeSentence();
if (!vocalEffects.some((effect) => effect.op === 'pause') || !vocalEffects.some((effect) => effect.op === 'resume')) {
  throw new Error(`Expected vocal pause and resume host effects, received ${JSON.stringify(vocalEffects)}`);
}

const azureName = vocal.processVisemeEvents(
  [{
    visemeId: 1,
    offsetMs: 0,
    durationMs: 120,
    debug: { provider: 'azure', providerId: 1, canonicalVisemeId: 1, morphTargetKey: '1' },
  }],
  'azure_vocal_test',
);
if (azureName !== 'azure_vocal_test') {
  throw new Error(`Expected explicit Azure vocal name, received ${azureName}`);
}

if (vocalScheduled.length !== 2 || vocalRemoved[0] !== vocalName) {
  throw new Error(`Expected starting Azure vocal to replace previous sentence, scheduled=${vocalScheduled.length}, removed=${vocalRemoved.join(', ')}`);
}

const azureVocalDebug = vocalScheduled[1].snippet.visemeDebug?.[0];
if (azureVocalDebug?.provider !== 'azure' ||
    azureVocalDebug.morphTargetKey !== '1' ||
    typeof azureVocalDebug.jawValue !== 'number' ||
    typeof azureVocalDebug.totalLipActivation !== 'number' ||
    typeof azureVocalDebug.activeMorphValue !== 'number') {
  throw new Error(`Expected vocal snippet to expose Azure activation debug, received ${JSON.stringify(vocalScheduled[1].snippet.visemeDebug)}`);
}

vocal.stopSentence();
if (!vocalRemoved.includes('azure_vocal_test')) {
  throw new Error(`Expected vocal stopSentence to remove active Azure snippet, removed ${vocalRemoved.join(', ')}`);
}

vocalState = vocal.getState();
if (vocalState.isSpeaking !== false || vocalState.snippetName !== null) {
  throw new Error(`Expected vocal state to stop cleanly, received ${JSON.stringify(vocalState)}`);
}

if (!vocalEvents.some((event) => event.type === 'WORD_BOUNDARY' && event.seeked === true)) {
  throw new Error(`Expected vocal WORD_BOUNDARY event with drift seek, received ${JSON.stringify(vocalEvents)}`);
}

if (vocalCleanupPlans.length < 2) {
  throw new Error(`Expected vocal cleanup plans for scheduled snippets, received ${JSON.stringify(vocalCleanupPlans)}`);
}

if (vocalStates.length < 5) {
  throw new Error(`Expected vocal state callbacks, received ${vocalStates.length}`);
}

vocal.dispose();

const lipSyncScheduled = [];
const lipSyncRemoved = [];
const lipSyncEvents = [];
const lipSyncCleanupPlans = [];
const lipSyncStates = [];

const lipSync = createLipSyncAgency(
  { lipsyncIntensity: 0.75, speechRate: 1.0, jawScale: 1.2 },
  {
    scheduleSnippet(snippet, opts) {
      lipSyncScheduled.push({ snippet, opts });
      return snippet.name;
    },
    removeSnippet(name) {
      lipSyncRemoved.push(name);
    },
    onLipSyncEvent(event) {
      lipSyncEvents.push(event);
    },
    onLipSyncCleanupPlan(plan) {
      lipSyncCleanupPlans.push(plan);
    },
    onState(state) {
      if (state?.config?.lipsyncIntensity === 0.75) {
        lipSyncStates.push(state);
      }
    },
  },
);

lipSync.startSpeech();
const lipSyncWordName = lipSync.processWord('Hello', 0, 300);
if (!lipSyncWordName?.startsWith('lipsync_hello_')) {
  throw new Error(`Expected CLJS lipsync word snippet name, received ${lipSyncWordName}`);
}

if (lipSyncScheduled.length !== 1) {
  throw new Error(`Expected CLJS lipsync word to schedule one snippet, received ${lipSyncScheduled.length}`);
}

const lipSyncWordSnippet = lipSyncScheduled[0].snippet;
if (lipSyncWordSnippet.snippetCategory !== 'visemeSnippet' || lipSyncWordSnippet.snippetJawScale !== 1.2) {
  throw new Error(`Unexpected CLJS lipsync word snippet: ${JSON.stringify(lipSyncWordSnippet)}`);
}

if (!lipSyncWordSnippet.curves?.['1']?.length) {
  throw new Error(`Expected CLJS lipsync word to include open-mouth viseme curves, received ${JSON.stringify(lipSyncWordSnippet.curves)}`);
}

let lipSyncState = lipSync.getState();
if (lipSyncState.status !== 'speaking' || lipSyncState.wordCount !== 1 || lipSyncState.isSpeaking !== true) {
  throw new Error(`Unexpected CLJS lipsync state after word: ${JSON.stringify(lipSyncState)}`);
}

const lipSyncAzureName = lipSync.processAzureVisemes(
  [
    { visemeId: 1, time: 0 },
    { visemeId: 4, time: 0.12 },
  ],
  240,
  {
    wordTimings: [{ word: 'ah', start: 0, end: 0.24 }],
    visualLeadMs: 20,
  },
);

if (!lipSyncAzureName?.startsWith('azure_lipsync_')) {
  throw new Error(`Expected CLJS lipsync Azure name, received ${lipSyncAzureName}`);
}

if (lipSyncScheduled.length !== 2 || lipSyncScheduled[1].snippet.snippetIntensityScale !== 0.75) {
  throw new Error(`Expected CLJS lipsync Azure scheduling with configured intensity, received ${JSON.stringify(lipSyncScheduled[1])}`);
}

const lipSyncAzureEvent = lipSyncEvents.find((event) => event.type === 'AZURE_SCHEDULED');
const lipSyncAzureDebug = lipSyncAzureEvent?.debugTimeline?.[0];
if (lipSyncAzureDebug?.provider !== 'azure' ||
    lipSyncAzureDebug.word !== 'ah' ||
    lipSyncAzureDebug.visualLeadMs !== 20 ||
    lipSyncAzureDebug.morphTargetKey !== String(lipSyncAzureDebug.canonicalVisemeId)) {
  throw new Error(`Expected CLJS lipsync Azure debug timeline, received ${JSON.stringify(lipSyncAzureEvent)}`);
}

const neutralName = lipSync.endSpeech();
if (!neutralName?.startsWith('neutral_')) {
  throw new Error(`Expected CLJS lipsync neutral return name, received ${neutralName}`);
}

lipSyncState = lipSync.getState();
if (lipSyncState.status !== 'ending' || lipSyncState.isSpeaking !== false) {
  throw new Error(`Expected CLJS lipsync ending state, received ${JSON.stringify(lipSyncState)}`);
}

if (lipSyncScheduled[2].snippet.curves['0']?.[0]?.inherit !== true) {
  throw new Error(`Expected CLJS lipsync neutral return to inherit current visemes, received ${JSON.stringify(lipSyncScheduled[2])}`);
}

if (lipSyncCleanupPlans.length < 3) {
  throw new Error(`Expected CLJS lipsync cleanup plans, received ${JSON.stringify(lipSyncCleanupPlans)}`);
}

lipSync.stop();
if (!lipSyncRemoved.includes(lipSyncWordName) || !lipSyncRemoved.includes(lipSyncAzureName)) {
  throw new Error(`Expected CLJS lipsync stop to remove active snippets, removed ${lipSyncRemoved.join(', ')}`);
}

if (!lipSyncEvents.some((event) => event.type === 'WORD_SCHEDULED') ||
    !lipSyncEvents.some((event) => event.type === 'AZURE_SCHEDULED')) {
  throw new Error(`Expected CLJS lipsync scheduling events, received ${JSON.stringify(lipSyncEvents)}`);
}

if (lipSyncStates.length < 5) {
  throw new Error(`Expected CLJS lipsync state callbacks, received ${lipSyncStates.length}`);
}

lipSync.dispose();

const ttsEvents = [];
const ttsTimelines = [];
const ttsCommands = [];
const ttsStates = [];

const tts = createTTSAgency(
  { rate: 1, azureVisualLeadMs: 35 },
  {
    onTTSEvent(event) {
      ttsEvents.push(event);
    },
    onTTSTimeline(timeline, vocalTimeline, emotionEvents) {
      ttsTimelines.push({ timeline, vocalTimeline, emotionEvents });
    },
    onAgencyCommand(target, command) {
      ttsCommands.push({ target, command });
    },
    onState(state) {
      if (state?.status && Array.isArray(state?.currentTimeline)) {
        ttsStates.push(state);
      }
    },
  },
);

const utteranceId = tts.startSpeech('we feel growth \u2600');
if (!utteranceId?.startsWith('utt_')) {
  throw new Error(`Expected CLJS TTS utterance id, received ${utteranceId}`);
}

const localPlan = tts.planText('we feel growth \u2600');
if (localPlan.text !== 'we feel growth' || localPlan.emotionEvents.length !== 1) {
  throw new Error(`Expected CLJS TTS local plan to strip emoji into emotion events, received ${JSON.stringify(localPlan)}`);
}

const azurePlan = tts.planAzureResponse('we feel growth \u2600', {
  word_boundaries: [
    { word: 'we', start_time: 0.04, end_time: 0.14 },
    { word: 'feel', start_time: 0.16, end_time: 0.34 },
    { word: 'growth', start_time: 0.4, end_time: 0.68 },
  ],
  visemes: [
    { id: 6, time: 0.06 },
    { viseme_id: 4, audio_offset: 0.24 },
    { viseme_id: 19, audioOffset: 6000000 },
  ],
});

if (azurePlan.vocalTimeline.source !== 'azure') {
  throw new Error(`Expected Azure TTS vocal timeline source, received ${JSON.stringify(azurePlan.vocalTimeline)}`);
}

if (azurePlan.vocalTimeline.durationSec < 0.79) {
  throw new Error(`Expected Azure TTS to infer duration from viseme and word timing, received ${azurePlan.vocalTimeline.durationSec}`);
}

const azureVisemeIds = azurePlan.vocalTimeline.visemes.map((event) => event.visemeId);
if (!azureVisemeIds.includes(4) || !azureVisemeIds.includes(13)) {
  throw new Error(`Expected Azure viseme refinement for long-E and TH, received ${azureVisemeIds.join(', ')}`);
}

const ledViseme = azurePlan.vocalTimeline.visemes.find((event) => event.visemeId === 4);
const rawTimelineViseme = azurePlan.timeline.find((event) => event.type === 'VISEME' && event.visemeId === 4);
if (!(ledViseme?.offsetMs < rawTimelineViseme?.offsetMs)) {
  throw new Error(`Expected Azure visual lead in vocal timeline, led=${JSON.stringify(ledViseme)}, raw=${JSON.stringify(rawTimelineViseme)}`);
}

const refinedThDebug = azurePlan.vocalTimeline.visemes.find((event) => event.debug?.providerId === 19)?.debug;
if (refinedThDebug?.provider !== 'azure' ||
    refinedThDebug.word !== 'growth' ||
    refinedThDebug.canonicalVisemeId !== 13 ||
    refinedThDebug.refined !== true ||
    refinedThDebug.visualLeadMs !== 35) {
  throw new Error(`Expected Azure TH refinement debug data, received ${JSON.stringify(azurePlan.vocalTimeline.visemes)}`);
}

tts.playbackStarted(utteranceId);
tts.processWordBoundary('we', 0.05, utteranceId);
tts.finishSpeech(utteranceId);

const commandCountBeforeStaleWord = ttsCommands.length;
const staleWordAccepted = tts.processWordBoundary('stale', 0.75, utteranceId);
if (staleWordAccepted !== false || ttsCommands.length !== commandCountBeforeStaleWord) {
  throw new Error(`Expected stale CLJS TTS word boundary to be ignored without agency commands, accepted=${staleWordAccepted}, commands=${JSON.stringify(ttsCommands.slice(commandCountBeforeStaleWord))}`);
}

const cancelledUtteranceId = tts.startSpeech('cancel me');
tts.planText('cancel me');
tts.stop();

const stateAfterStop = tts.getSnapshot();
if (!stateAfterStop.cancelledUtteranceIds?.includes(cancelledUtteranceId)) {
  throw new Error(`Expected CLJS TTS stop to remember cancelled utterance, received ${JSON.stringify(stateAfterStop)}`);
}

const commandCountBeforeStalePlayback = ttsCommands.length;
const stalePlaybackAccepted = tts.playbackStarted(cancelledUtteranceId);
if (stalePlaybackAccepted !== false || ttsCommands.length !== commandCountBeforeStalePlayback) {
  throw new Error(`Expected stale CLJS TTS playback start to be ignored without agency commands, accepted=${stalePlaybackAccepted}, commands=${JSON.stringify(ttsCommands.slice(commandCountBeforeStalePlayback))}`);
}

if (!ttsEvents.some((event) => event.type === 'AZURE_RESPONSE_PLANNED') ||
    !ttsEvents.some((event) => event.type === 'WORD_BOUNDARY') ||
    !ttsEvents.some((event) => event.type === 'STALE_UTTERANCE_IGNORED')) {
  throw new Error(`Expected CLJS TTS planning and word boundary events, received ${JSON.stringify(ttsEvents)}`);
}

if (!ttsCommands.some((entry) => entry.target === 'vocal' && entry.command.type === 'startTimeline') ||
    !ttsCommands.some((entry) => entry.target === 'prosodic' && entry.command.type === 'pulse')) {
  throw new Error(`Expected CLJS TTS to command vocal and prosodic agencies, received ${JSON.stringify(ttsCommands)}`);
}

if (ttsTimelines.length < 2 || ttsStates.length < 6 || tts.getState().status !== 'idle') {
  throw new Error(`Unexpected CLJS TTS smoke state: timelines=${ttsTimelines.length}, states=${ttsStates.length}, state=${JSON.stringify(tts.getState())}`);
}

tts.dispose();

const transcriptionEvents = [];
const transcriptionCommands = [];
const transcriptionRecommendations = [];
const transcriptionStates = [];

const transcription = createTranscriptionAgency(
  {
    interruptionThreshold: 0.1,
    referenceRatio: 1.5,
    releaseThreshold: 0.05,
    releaseMs: 300,
    autoRestart: true,
    restartDelayMs: 125,
    maxRestartCount: 2,
  },
  {
    onTranscriptionEvent(event) {
      transcriptionEvents.push(event);
    },
    onTranscriptionRecommendation(recommendation) {
      transcriptionRecommendations.push(recommendation);
    },
    onAgencyCommand(target, command) {
      transcriptionCommands.push({ target, command });
    },
    onState(state) {
      if (state?.status && typeof state?.isListening === 'boolean') {
        transcriptionStates.push(state);
      }
    },
  },
);

transcription.start();
transcription.processAudioLevel(0.2, 0.02, 1000);
transcription.processResult(' stop that ', true, 0.9, 'speechRecognition');
transcription.processAudioLevel(0.01, 0, 1400);

const transcriptionState = transcription.getState();
if (transcriptionState.finalTranscript !== 'stop that' || transcriptionState.isInterrupted !== false) {
  throw new Error(`Unexpected CLJS transcription state: ${JSON.stringify(transcriptionState)}`);
}

if (!transcriptionEvents.some((event) => event.type === 'INTERRUPTION_DETECTED') ||
    !transcriptionEvents.some((event) => event.type === 'INTERRUPTION_RELEASED') ||
    !transcriptionEvents.some((event) => event.type === 'TRANSCRIPT_FINAL')) {
  throw new Error(`Expected CLJS transcription interruption/final events, received ${JSON.stringify(transcriptionEvents)}`);
}

if (!transcriptionCommands.some((entry) => entry.target === 'conversation' && entry.command.type === 'interrupt') ||
    !transcriptionCommands.some((entry) => entry.target === 'conversation' && entry.command.type === 'userSpeech')) {
  throw new Error(`Expected CLJS transcription to command conversation, received ${JSON.stringify(transcriptionCommands)}`);
}

if (transcriptionStates.length < 5) {
  throw new Error(`Expected CLJS transcription state callbacks, received ${transcriptionStates.length}`);
}

transcription.fail('network drop');
const restartRecommendation = transcriptionRecommendations.find((recommendation) => recommendation.type === 'RESTART');
if (!restartRecommendation ||
    restartRecommendation.reason !== 'error' ||
    restartRecommendation.delayMs !== 125 ||
    restartRecommendation.restartCount !== 1 ||
    restartRecommendation.maxRestartCount !== 2) {
  throw new Error(`Expected CLJS transcription restart recommendation, received ${JSON.stringify(transcriptionRecommendations)}`);
}

const failedTranscriptionState = transcription.getState();
if (failedTranscriptionState.restartCount !== 1 ||
    failedTranscriptionState.pendingRestart?.type !== 'RESTART' ||
    failedTranscriptionState.error !== 'network drop') {
  throw new Error(`Expected CLJS transcription failure state to retain restart data, received ${JSON.stringify(failedTranscriptionState)}`);
}

transcription.stop();
const cleanupRecommendation = transcriptionRecommendations.find((recommendation) => (
  recommendation.type === 'CLEANUP' &&
  recommendation.reason === 'stop'
));
if (!cleanupRecommendation || cleanupRecommendation.cancelRestart !== true || cleanupRecommendation.releaseBrowserResources !== true) {
  throw new Error(`Expected CLJS transcription cleanup recommendation, received ${JSON.stringify(transcriptionRecommendations)}`);
}

transcription.dispose();

const restartLimitedRecommendations = [];
const restartLimitedTranscription = createTranscriptionAgency(
  { autoRestart: true, maxRestartCount: 0 },
  {
    onTranscriptionRecommendation(recommendation) {
      restartLimitedRecommendations.push(recommendation);
    },
  },
);
restartLimitedTranscription.start();
restartLimitedTranscription.fail('permission denied');
const stopRecommendation = restartLimitedRecommendations.find((recommendation) => recommendation.type === 'STOP');
if (!stopRecommendation || stopRecommendation.reason !== 'maxRestartCount') {
  throw new Error(`Expected CLJS transcription max-restart stop recommendation, received ${JSON.stringify(restartLimitedRecommendations)}`);
}
restartLimitedTranscription.dispose();

const conversationEvents = [];
const conversationCommands = [];
const conversationStates = [];

const conversation = createConversationAgency(
  { autoListen: true },
  {
    onConversationEvent(event) {
      conversationEvents.push(event);
    },
    onAgencyCommand(target, command) {
      conversationCommands.push({ target, command });
    },
    onState(state) {
      if (state?.state && typeof state?.isRunning === 'boolean') {
        conversationStates.push(state);
      }
    },
  },
);

conversation.start();
conversation.agentStart('hello there');
conversation.interrupt('audio');
conversation.userSpeech('wait', true, true);
conversation.processingComplete();
conversation.stop();

const conversationState = conversation.getState();
if (conversationState.state !== 'idle' || conversationState.isRunning !== false) {
  throw new Error(`Unexpected CLJS conversation state: ${JSON.stringify(conversationState)}`);
}

if (!conversationEvents.some((event) => event.type === 'AGENT_SPEAKING') ||
    !conversationEvents.some((event) => event.type === 'INTERRUPTED') ||
    !conversationEvents.some((event) => event.type === 'USER_FINAL')) {
  throw new Error(`Expected CLJS conversation turn events, received ${JSON.stringify(conversationEvents)}`);
}

if (!conversationCommands.some((entry) => entry.target === 'tts' && entry.command.type === 'startSpeech') ||
    !conversationCommands.some((entry) => entry.target === 'tts' && entry.command.type === 'stop') ||
    !conversationCommands.some((entry) => entry.target === 'lipsync' && entry.command.type === 'stop') ||
    !conversationCommands.some((entry) => entry.target === 'transcription' && entry.command.type === 'start') ||
    !conversationCommands.some((entry) => entry.target === 'gaze' && entry.command.type === 'resetToNeutral')) {
  throw new Error(`Expected CLJS conversation orchestration commands, received ${JSON.stringify(conversationCommands)}`);
}

if (conversationStates.length < 7) {
  throw new Error(`Expected CLJS conversation state callbacks, received ${conversationStates.length}`);
}

conversation.dispose();

const featureGatedConversationCommands = [];
const featureGatedConversation = createConversationAgency(
  { autoListen: false, useGaze: false, useProsody: false, useBlink: false },
  {
    onAgencyCommand(target, command) {
      featureGatedConversationCommands.push({ target, command });
    },
  },
);

featureGatedConversation.start();
featureGatedConversation.agentStart('quiet mode');
featureGatedConversation.interrupt('manual');
featureGatedConversation.stop();

if (featureGatedConversationCommands.some((entry) => (
  entry.target === 'gaze' ||
  entry.target === 'prosodic' ||
  entry.target === 'blink' ||
  (entry.target === 'transcription' && entry.command.type === 'start')
))) {
  throw new Error(`Expected disabled conversation features to skip their commands, received ${JSON.stringify(featureGatedConversationCommands)}`);
}

if (!featureGatedConversationCommands.some((entry) => entry.target === 'tts' && entry.command.type === 'stop') ||
    !featureGatedConversationCommands.some((entry) => entry.target === 'vocal' && entry.command.type === 'stop') ||
    !featureGatedConversationCommands.some((entry) => entry.target === 'lipsync' && entry.command.type === 'stop')) {
  throw new Error(`Expected disabled-feature conversation to still stop speech surfaces, received ${JSON.stringify(featureGatedConversationCommands)}`);
}

featureGatedConversation.dispose();

const hairObjectStates = [];
const hairPhysicsUpdates = [];
const hairStates = [];

const hair = createHairAgency(
  undefined,
  {
    applyHairStateToObject(name, objectState) {
      hairObjectStates.push({ name, objectState });
    },
    applyHairPhysics(enabled, config) {
      hairPhysicsUpdates.push({ enabled, config });
    },
    onState(state) {
      if (state?.hairState) {
        hairStates.push(state);
      }
    },
  },
);

hair.registerObjects([
  { name: 'Bangs', isEyebrow: false, isMesh: true },
  { name: 'Left_Brow', isEyebrow: true, isMesh: true },
  { name: 'Hair_Root', isEyebrow: false, isMesh: false },
]);

if (hairObjectStates.length !== 0) {
  throw new Error('Expected registerObjects to preserve model hair without applying default colors');
}

hair.setHairBaseColor('#112233');

if (hairObjectStates.length !== 2) {
  throw new Error(`Expected two mesh hair object updates, received ${hairObjectStates.length}`);
}

const bangsUpdate = hairObjectStates.find((entry) => entry.name === 'Bangs');
if (bangsUpdate?.objectState.color.baseColor !== '#112233') {
  throw new Error(`Expected Bangs base color to update, received ${bangsUpdate?.objectState.color.baseColor}`);
}

const eyebrowUpdate = hairObjectStates.find((entry) => entry.name === 'Left_Brow');
if (eyebrowUpdate?.objectState.color.baseColor !== '#4a3728') {
  throw new Error(`Expected eyebrow color to remain default brown, received ${eyebrowUpdate?.objectState.color.baseColor}`);
}

hair.setPartVisibility('Bangs', false);
hair.setPartScale('Bangs', 1.25);
hair.setPartPosition('Bangs', [0.1, -0.2, 0.3]);
hair.setOutline(true, '#ff00ff', 0.5);
hair.send({ type: 'SET_EYEBROW_BASE_COLOR', baseColor: '#445566' });
hair.setPhysicsEnabled(true);
hair.updatePhysicsConfig({ windStrength: 0.4 });

const hairState = hair.getState();
const bangsState = hairState.hairState.parts.Bangs;

if (hairState.hairState.hairColor.baseColor !== '#112233') {
  throw new Error(`Expected hair color in CLJS state, received ${hairState.hairState.hairColor.baseColor}`);
}

if (hairState.hairState.eyebrowColor.baseColor !== '#445566') {
  throw new Error(`Expected eyebrow color from legacy event, received ${hairState.hairState.eyebrowColor.baseColor}`);
}

if (bangsState?.visible !== false || bangsState?.scale !== 1.25 || bangsState?.position?.[2] !== 0.3) {
  throw new Error(`Unexpected Bangs part state: ${JSON.stringify(bangsState)}`);
}

if (hairState.hairState.showOutline !== true || hairState.hairState.outlineOpacity !== 0.5) {
  throw new Error(`Unexpected outline state: ${JSON.stringify(hairState.hairState)}`);
}

const physicsConfig = hair.getPhysicsConfig();
if (physicsConfig.enabled !== true || physicsConfig.windStrength !== 0.4) {
  throw new Error(`Unexpected hair physics config: ${JSON.stringify(physicsConfig)}`);
}

if (hairPhysicsUpdates.length !== 2) {
  throw new Error(`Expected two hair physics updates, received ${hairPhysicsUpdates.length}`);
}

hair.resetToDefault();
if (hair.getHairState().hairColor.baseColor !== '#4a3728') {
  throw new Error('Expected resetToDefault to restore natural brown hair');
}

if (hairStates.length < 8) {
  throw new Error(`Expected hair state callbacks for registration and updates, received ${hairStates.length}`);
}

hair.dispose();

console.log(
  `CLJS smoke passed: blink ${snippet.name}; automatic count ${scheduledAfterAuto - 1}; animation states ${animationStates.length}; gaze snippets ${gazeScheduled.length}; eye/head states ${eyeHeadStates.length}; prosodic states ${prosodicStates.length}; vocal states ${vocalStates.length}; lipsync states ${lipSyncStates.length}; tts states ${ttsStates.length}; transcription states ${transcriptionStates.length}; conversation states ${conversationStates.length}; hair states ${hairStates.length}`,
);
