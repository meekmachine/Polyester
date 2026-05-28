export interface WorkerAgencyOutput {
  type: string;
  agency: string;
  [key: string]: unknown;
}

export interface WorkerAgencyHost {
  scheduleSnippet?: (snippet: unknown, opts?: { autoPlay?: boolean }) => string | null;
  schedule?: (snippet: unknown, opts?: AnimationScheduleOptions) => string | null;
  updateSnippet?: (snippet: AnimationSnippet) => string | null;
  removeSnippet?: (name: string) => void;
  remove?: (name: string) => void;
  seekSnippet?: (name: string, offsetSec: number) => void;
  seek?: (name: string, offsetSec: number) => void;
  pauseSnippet?: (name: string) => void;
  resumeSnippet?: (name: string) => void;
  restartSnippet?: (name: string) => void;
  play?: () => void;
  pause?: () => void;
  stop?: () => void;
  setSnippetPlaybackRate?: (name: string, rate: number) => void;
  setSnippetIntensityScale?: (name: string, scale: number) => void;
  setSnippetLoopMode?: (name: string, mode: AnimationLoopMode) => void;
  setSnippetReverse?: (name: string, reverse: boolean) => void;
  onAnimationEffect?: (effect: AnimationEffect) => void;
  onAnimationEvent?: (event: AnimationEvent) => void;
  onProsodicEvent?: (event: ProsodicEvent) => void;
  onProsodicFadePlan?: (plan: ProsodicFadePlan) => void;
  onVocalEvent?: (event: VocalEvent) => void;
  onVocalCleanupPlan?: (plan: VocalCleanupPlan) => void;
  onLipSyncEvent?: (event: LipSyncEvent) => void;
  onLipSyncCleanupPlan?: (plan: LipSyncCleanupPlan) => void;
  onTTSEvent?: (event: TTSEvent) => void;
  onTTSTimeline?: (
    timeline: TTSTimelineEvent[],
    vocalTimeline: VocalTimeline,
    emotionEvents: TTSEmojiTimelineEvent[],
  ) => void;
  onTranscriptionEvent?: (event: TranscriptionEvent) => void;
  onTranscriptionRecommendation?: (recommendation: TranscriptionRecommendation) => void;
  onConversationEvent?: (event: ConversationEvent) => void;
  onAgencyCommand?: (target: string, command: Record<string, unknown>) => void;
  onTTSCommand?: (command: Record<string, unknown>) => void;
  onTranscriptionCommand?: (command: Record<string, unknown>) => void;
  onConversationCommand?: (command: Record<string, unknown>) => void;
  onVocalCommand?: (command: Record<string, unknown>) => void;
  onProsodicCommand?: (command: Record<string, unknown>) => void;
  onGazeCommand?: (command: Record<string, unknown>) => void;
  onBlinkCommand?: (command: Record<string, unknown>) => void;
  applyHairState?: (
    state: HairState,
    objects: HairObjectRef[],
    objectStates: HairObjectStateUpdate[],
  ) => void;
  applyHairStateToObject?: (name: string, objectState: HairObjectState) => void;
  applyHairPhysics?: (enabled: boolean, config: HairPhysicsRuntimeConfig) => void;
  setHairPhysicsConfig?: (config: HairPhysicsRuntimeConfig) => void;
  setHairPhysicsEnabled?: (enabled: boolean) => void;
  onOutput?: (output: WorkerAgencyOutput) => void;
  onState?: (state: unknown) => void;
  onError?: (output: WorkerAgencyOutput) => void;
}

export type AnimationEasingType = 'linear' | 'easeInOut' | 'easeInOutCubic' | 'easeIn' | 'easeOut';
export type AnimationLoopMode = 'once' | 'repeat' | 'pingpong';
export type AnimationBlendMode = 'replace' | 'additive';
export type AnimationSnippetCategory = 'auSnippet' | 'visemeSnippet' | 'eyeHeadTracking' | 'combined' | 'default';

export interface AnimationCurvePoint {
  time: number;
  intensity: number;
  inherit?: boolean;
}

export interface AnimationSnippet {
  name?: string;
  curves?: Record<string, AnimationCurvePoint[]>;
  au?: Array<{ t: number; id: number; v: number; inherit?: boolean }>;
  viseme?: Array<{ t: number; key: string; v: number; inherit?: boolean }>;
  loop?: boolean;
  isPlaying?: boolean;
  currentTime?: number;
  snippetCategory?: AnimationSnippetCategory;
  snippetPriority?: number;
  snippetPlaybackRate?: number;
  snippetIntensityScale?: number;
  snippetBlendMode?: AnimationBlendMode;
  snippetJawScale?: number;
  autoVisemeJaw?: boolean;
  snippetBalance?: number;
  snippetBalanceMap?: Record<string, number>;
  snippetEasing?: AnimationEasingType;
  mixerChannel?: string;
  mixerBlendMode?: string;
  mixerWeight?: number;
  mixerFadeDurationMs?: number;
  mixerWarpDurationMs?: number;
  mixerTimeScale?: number;
  mixerLoopMode?: AnimationLoopMode;
  mixerRepeatCount?: number;
  mixerClampWhenFinished?: boolean;
  mixerAdditive?: boolean;
  mixerReverse?: boolean;
  [key: string]: unknown;
}

export interface NormalizedAnimationSnippet extends Required<Pick<
  AnimationSnippet,
  | 'name'
  | 'curves'
  | 'loop'
  | 'isPlaying'
  | 'currentTime'
  | 'snippetCategory'
  | 'snippetPriority'
  | 'snippetPlaybackRate'
  | 'snippetIntensityScale'
  | 'snippetBlendMode'
  | 'snippetJawScale'
  | 'snippetBalance'
  | 'snippetBalanceMap'
  | 'snippetEasing'
  | 'mixerLoopMode'
  | 'mixerReverse'
>> {
  loopIteration: number;
  loopDirection: 1 | -1;
  lastLoopTime: number;
  startWallTime: number;
  duration: number;
  cursor: Record<string, number>;
  autoVisemeJaw?: boolean;
  mixerChannel?: string;
  mixerBlendMode?: string;
  mixerWeight?: number;
  mixerFadeDurationMs?: number;
  mixerWarpDurationMs?: number;
  mixerTimeScale?: number;
  mixerRepeatCount?: number;
  mixerClampWhenFinished?: boolean;
  mixerAdditive?: boolean;
}

export interface AnimationScheduleOptions {
  startInSec?: number;
  startAtSec?: number;
  offsetSec?: number;
  priority?: number;
  autoPlay?: boolean;
}

export interface AnimationScheduleEntry {
  name: string;
  startsAt: number;
  offset: number;
  enabled: boolean;
}

export interface AnimationAgencyState {
  snippets: Record<string, NormalizedAnimationSnippet>;
  order: string[];
  schedule: Record<string, AnimationScheduleEntry>;
  globalPlaybackState: 'playing' | 'paused' | 'stopped';
  eventCount: number;
  lastUpdatedTime: number | null;
}

export interface AnimationScheduleSnapshotEntry {
  name: string;
  enabled: boolean;
  startsAt: number;
  offset: number;
  localTime: number;
  duration: number;
  loop: boolean;
  priority: number;
  playbackRate: number;
  intensityScale: number;
}

export interface AnimationEffect {
  op: string;
  name?: string;
  snippet?: NormalizedAnimationSnippet;
  opts?: AnimationScheduleOptions;
  offsetSec?: number;
  playbackRate?: number;
  intensityScale?: number;
  mixerLoopMode?: AnimationLoopMode;
  reverse?: boolean;
  [key: string]: unknown;
}

export interface AnimationEvent {
  type: string;
  timestamp: number;
  snippetName?: string;
  state?: 'playing' | 'paused' | 'stopped';
  isPlaying?: boolean;
  time?: number;
  params?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface AnimationAgency {
  loadFromJSON(data: AnimationSnippet): string;
  schedule(snippet: AnimationSnippet, opts?: AnimationScheduleOptions): string;
  updateSnippet(snippet: AnimationSnippet): string;
  remove(name: string): boolean;
  play(): boolean;
  pause(): boolean;
  stop(): boolean;
  enable(name: string, on?: boolean): boolean;
  seek(name: string, offsetSec: number): boolean;
  setSnippetPlaying(name: string, isPlaying: boolean): boolean;
  setSnippetTime(name: string, time: number): boolean;
  setSnippetPlaybackRate(name: string, rate: number): boolean;
  setSnippetIntensityScale(name: string, scale: number): boolean;
  setSnippetLoopMode(name: string, mode: AnimationLoopMode): boolean;
  setSnippetReverse(name: string, reverse: boolean): boolean;
  getState(): AnimationAgencyState;
  getScheduleSnapshot(): AnimationScheduleSnapshotEntry[];
  dispose(): void;
}

export interface BlinkAgencyState {
  enabled: boolean;
  frequency: number;
  duration: number;
  intensity: number;
  randomness: number;
  leftEyeIntensity: number | null;
  rightEyeIntensity: number | null;
  lastBlinkTime: number | null;
  scheduledBlinkCount: number;
}

export interface BlinkAgencyConfig {
  enabled?: boolean;
  frequency?: number;
  duration?: number;
  intensity?: number;
  randomness?: number;
  leftEyeIntensity?: number | null;
  rightEyeIntensity?: number | null;
}

export interface BlinkTriggerOptions {
  intensity?: number;
  duration?: number;
}

export interface BlinkAgency {
  configure(config: BlinkAgencyConfig): void;
  enable(): void;
  disable(): void;
  setFrequency(frequency: number): void;
  setDuration(duration: number): void;
  setIntensity(intensity: number): void;
  setRandomness(randomness: number): void;
  triggerBlink(options?: BlinkTriggerOptions): void;
  reset(): void;
  getState(): BlinkAgencyState;
  dispose(): void;
}

export interface GazeTarget {
  x: number;
  y: number;
  z?: number;
}

export type GazeMode = 'manual' | 'mouse' | 'webcam';

export interface GazeAgencyConfig {
  eyesEnabled?: boolean;
  headEnabled?: boolean;
  headFollowEyes?: boolean;
  mirrored?: boolean;
  smoothFactor?: number;
  minDelta?: number;
  eyeIntensity?: number;
  headIntensity?: number;
  duration?: number;
  eyeDuration?: number;
  headDuration?: number;
  eyePriority?: number;
  headPriority?: number;
  headRoll?: number;
}

export interface GazeAgencyState {
  target: Required<GazeTarget>;
  current: Required<GazeTarget>;
  mode: GazeMode;
  isActive: boolean;
  scheduledGazeCount: number;
  lastScheduledTime: number | null;
  config: Required<Omit<GazeAgencyConfig, 'eyeDuration' | 'headDuration'>> & Pick<GazeAgencyConfig, 'eyeDuration' | 'headDuration'>;
}

export interface GazeAgency {
  configure(config: GazeAgencyConfig): void;
  updateConfig(config: GazeAgencyConfig): void;
  setMode(mode: GazeMode): void;
  setTarget(target: GazeTarget): boolean;
  schedule(target: GazeTarget): boolean;
  resetToNeutral(duration?: number): void;
  stop(): void;
  getState(): GazeAgencyState;
  dispose(): void;
}

export interface EyeHeadTrackingConfig extends GazeAgencyConfig {
  gazeMode?: 'engine' | 'legacy' | 'experimental';
  eyeTrackingEnabled?: boolean;
  headTrackingEnabled?: boolean;
  agencyTransitionDuration?: number;
  useAnimationAgency?: boolean;
  returnToNeutralEnabled?: boolean;
  returnToNeutralDelay?: number;
  returnToNeutralDuration?: number;
}

export interface EyeHeadTrackingState {
  eyeStatus: 'idle' | 'tracking' | 'lagging';
  headStatus: 'idle' | 'tracking' | 'lagging';
  currentGaze: Required<GazeTarget>;
  targetGaze: Required<GazeTarget>;
  eyeIntensity: number;
  lastBlinkTime: number | null;
  headIntensity: number;
  headFollowTimer: number | null;
  isSpeaking: boolean;
  isListening: boolean;
  returnToNeutralTimer: number | null;
  lastGazeUpdateTime: number | null;
  mode: GazeMode;
  scheduledGazeCount: number;
  config: GazeAgencyState['config'];
}

export interface EyeHeadTrackingAgency {
  configure(config: EyeHeadTrackingConfig): void;
  updateConfig(config: EyeHeadTrackingConfig): void;
  start(): void;
  setMode(mode: GazeMode): void;
  getMode(): GazeMode;
  setGazeTarget(target: GazeTarget): boolean;
  setTarget(target: GazeTarget): boolean;
  schedule(target: GazeTarget): boolean;
  resetToNeutral(duration?: number): void;
  pause(): void;
  resume(): void;
  stop(): void;
  getState(): EyeHeadTrackingState;
  getSnapshot(): GazeAgencyState;
  dispose(): void;
}

export interface ProsodicConfig {
  browPriority?: number;
  headPriority?: number;
  pulsePriority?: number;
  defaultIntensity?: number;
  fadeSteps?: number;
  fadeStepInterval?: number;
}

export interface ProsodicSnippetInput {
  name?: string;
  curves?: Record<string, AnimationCurvePoint[]>;
  snippetIntensityScale?: number;
  snippetPlaybackRate?: number;
  priority?: number;
}

export interface ProsodicState {
  browStatus: 'idle' | 'active' | 'stopping';
  headStatus: 'idle' | 'active' | 'stopping';
  browIntensity: number;
  headIntensity: number;
  isLooping: boolean;
}

export interface ProsodicSnapshot {
  status: 'idle' | 'speaking' | 'fading';
  browSnippet: unknown | null;
  headSnippet: unknown | null;
  scheduledNames: { brow: string | null; head: string | null };
  fadeInProgress: { brow: boolean; head: boolean };
  lastPulseWordIndex: number | null;
  config: Required<ProsodicConfig>;
  eventCount: number;
  lastUpdatedTime: number | null;
}

export interface ProsodicEvent {
  type: string;
  timestamp: number;
  snippetName?: string;
  wordIndex?: number;
  channel?: 'brow' | 'head' | 'both';
  [key: string]: unknown;
}

export interface ProsodicFadePlanStep {
  channel: 'brow' | 'head';
  name: string;
  intensity: number;
  delayMs: number;
  removeOnComplete: boolean;
}

export interface ProsodicFadePlan {
  steps: ProsodicFadePlanStep[];
}

export interface ProsodicAgency {
  loadBrow(data: ProsodicSnippetInput): void;
  loadHead(data: ProsodicSnippetInput): void;
  updateConfig(config: ProsodicConfig): void;
  startTalking(): void;
  stopTalking(): void;
  pulse(wordIndex: number): void;
  stop(): void;
  getState(): ProsodicState;
  getSnapshot(): ProsodicSnapshot;
  dispose(): void;
}

export type VocalSource = 'text' | 'azure' | 'livekit' | 'webSpeech';

export interface VocalConfig {
  intensity?: number;
  speechRate?: number;
  jawScale?: number;
  rampMs?: number;
  holdMs?: number;
  priority?: number;
}

export interface VocalVisemeEvent {
  visemeId: number;
  offsetMs: number;
  durationMs: number;
}

export interface VocalWordTiming {
  word: string;
  startSec: number;
  endSec: number;
}

export interface VocalTimeline {
  name?: string;
  utteranceId?: string;
  text?: string;
  visemes: VocalVisemeEvent[];
  wordTimings?: VocalWordTiming[];
  durationSec?: number;
  source?: VocalSource;
}

export interface VocalSnippet {
  name: string;
  snippetCategory: 'combined';
  snippetPriority: number;
  snippetPlaybackRate: number;
  snippetIntensityScale: number;
  snippetJawScale?: number;
  autoVisemeJaw?: boolean;
  loop: boolean;
  maxTime: number;
  curves: Record<string, AnimationCurvePoint[]>;
}

export interface VocalState {
  isSpeaking: boolean;
  currentWord: string | null;
  currentViseme: number | null;
  snippetName: string | null;
  startTime: number | null;
}

export interface VocalSentenceSnapshot {
  name: string;
  text: string;
  startTime: number;
  maxTime: number;
  wordIndex: number;
  wordTimings: VocalWordTiming[];
}

export interface VocalSnapshot extends VocalState {
  currentSentence: VocalSentenceSnapshot | null;
  activeSnippets: string[];
  config: Required<VocalConfig>;
  eventCount: number;
  lastUpdatedTime: number | null;
}

export interface VocalEvent {
  type: string;
  timestamp: number;
  snippetName?: string;
  source?: VocalSource;
  word?: string;
  wordIndex?: number;
  elapsedSec?: number;
  driftSec?: number;
  seeked?: boolean;
  [key: string]: unknown;
}

export interface VocalCleanupPlan {
  name: string;
  delayMs: number;
}

export interface VocalAgency {
  updateConfig(config: VocalConfig): boolean;
  startTimeline(timeline: VocalTimeline): string | null;
  startSentence(text: string): string | null;
  onWordBoundary(word: string, wordIndex?: number, observedElapsedSec?: number): boolean;
  updateWordTimings(wordTimings: VocalWordTiming[]): boolean;
  stopSentence(): boolean;
  pauseSentence(): boolean;
  resumeSentence(): boolean;
  speak(text: string): string | null;
  speakWord(word: string): string | null | boolean;
  processWordBoundary(timing: { word: string; startMs: number; durationMs?: number }): string | null | boolean;
  processVisemeEvents(events: VocalVisemeEvent[], name?: string): string | null;
  stop(): boolean;
  getState(): VocalState;
  getSnapshot(): VocalSnapshot;
  dispose(): void;
}

export interface LipSyncConfig {
  engine?: 'webSpeech' | 'sapi' | string;
  onsetIntensity?: number;
  holdMs?: number;
  speechRate?: number;
  lipsyncIntensity?: number;
  jawScale?: number;
}

export interface LipSyncState {
  status: 'idle' | 'speaking' | 'ending';
  wordCount: number;
  isSpeaking: boolean;
}

export interface LipSyncSnapshot extends LipSyncState {
  activeSnippets: string[];
  lastWord: string | null;
  config: Required<LipSyncConfig>;
  eventCount: number;
  lastUpdatedTime: number | null;
}

export interface LipSyncAzureVisemeEvent {
  visemeId?: number;
  viseme_id?: number;
  id?: number;
  time?: number;
  audio_offset?: number;
  audioOffset?: number;
}

export interface LipSyncEvent {
  type: string;
  timestamp: number;
  word?: string;
  wordIndex?: number;
  snippetName?: string;
  eventCount?: number;
  [key: string]: unknown;
}

export interface LipSyncCleanupPlan {
  name: string;
  delayMs: number;
}

export interface LipSyncAgency {
  startSpeech(): boolean;
  processWord(word: string, wordIndex: number, actualDurationMs?: number): string | null;
  processAzureVisemes(
    events: LipSyncAzureVisemeEvent[],
    totalDurationMs?: number,
    options?: { wordTimings?: Array<Record<string, unknown>>; visualLeadMs?: number },
  ): string | null;
  endSpeech(): string | null;
  stop(): boolean;
  updateConfig(config: LipSyncConfig): boolean;
  getState(): LipSyncState;
  getSnapshot(): LipSyncSnapshot;
  dispose(): void;
}

export type TTSStatus = 'idle' | 'loading' | 'speaking' | 'paused' | 'error';

export interface TTSAgencyConfig {
  engine?: 'webSpeech' | 'sapi' | 'azure' | 'livekit' | string;
  rate?: number;
  pitch?: number;
  volume?: number;
  voiceName?: string;
  lang?: string;
  lipsyncIntensity?: number;
  jawScale?: number;
  azureVisualLeadMs?: number;
}

export interface TTSAzureVisemeEvent {
  visemeId?: number;
  viseme_id?: number;
  id?: number;
  time?: number;
  audio_offset?: number;
  audioOffset?: number;
}

export interface TTSWordBoundary {
  word: string;
  start_time?: number;
  end_time?: number;
  startSec?: number;
  endSec?: number;
  start?: number;
  end?: number;
}

export interface TTSAzureResponse {
  visemes?: TTSAzureVisemeEvent[];
  word_boundaries?: TTSWordBoundary[];
  wordBoundaries?: TTSWordBoundary[];
  words?: TTSWordBoundary[];
  duration?: number;
}

export interface TTSWordTimelineEvent {
  type: 'WORD';
  word: string;
  index: number;
  offsetMs: number;
}

export interface TTSVisemeTimelineEvent {
  type: 'VISEME';
  visemeId: number;
  offsetMs: number;
  durMs: number;
}

export interface TTSEmojiTimelineEvent {
  type: 'EMOJI';
  emoji: string;
  offsetMs: number;
}

export type TTSTimelineEvent =
  | TTSWordTimelineEvent
  | TTSVisemeTimelineEvent
  | TTSEmojiTimelineEvent;

export interface TTSPlan {
  utteranceId: string;
  text: string;
  timeline: TTSTimelineEvent[];
  vocalTimeline: VocalTimeline;
  emotionEvents: TTSEmojiTimelineEvent[];
}

export interface TTSAgencyState {
  status: TTSStatus;
  currentText?: string | null;
  currentTimeline?: TTSTimelineEvent[];
  currentVoice?: unknown | null;
  utteranceId?: string | null;
  cancelledUtteranceIds?: string[];
  error?: string | null;
}

export interface TTSSnapshot extends TTSAgencyState {
  wordIndex: number;
  config: Required<TTSAgencyConfig>;
  eventCount: number;
  lastUpdatedTime: number | null;
}

export interface TTSEvent {
  type: string;
  timestamp: number;
  utteranceId?: string;
  text?: string;
  word?: string;
  wordIndex?: number;
  elapsedSec?: number;
  message?: string;
  [key: string]: unknown;
}

export interface TTSAgency {
  updateConfig(config: TTSAgencyConfig): boolean;
  startSpeech(text: string): string;
  planText(text: string): TTSPlan;
  planAzureResponse(text: string, response: TTSAzureResponse, durationSec?: number): TTSPlan;
  playbackStarted(utteranceId?: string): boolean;
  processWordBoundary(word: string, elapsedSec?: number, utteranceId?: string): boolean;
  finishSpeech(utteranceId?: string): boolean;
  pause(): boolean;
  resume(): boolean;
  stop(): boolean;
  fail(message: string): boolean;
  getState(): TTSAgencyState;
  getSnapshot(): TTSSnapshot;
  dispose(): void;
}

export interface TranscriptionConfig {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  echoSuppression?: boolean;
  interruptionThreshold?: number;
  referenceRatio?: number;
  releaseThreshold?: number;
  releaseMs?: number;
  autoRestart?: boolean;
  restartDelayMs?: number;
  maxRestartCount?: number;
}

export interface TranscriptionAgencyState {
  status: 'idle' | 'listening' | 'error';
  isListening: boolean;
  interimTranscript: string;
  finalTranscript: string;
  isInterrupted: boolean;
  interruptionSource: string | null;
  error: string | null;
  restartCount: number;
  pendingRestart: TranscriptionRecommendation | null;
  lastRecommendation: TranscriptionRecommendation | null;
}

export interface TranscriptionSnapshot extends TranscriptionAgencyState {
  lastTranscript: string;
  lastConfidence: number | null;
  lastUserLevel: number;
  lastReferenceLevel: number;
  lastInterruptionTime: number | null;
  config: Required<TranscriptionConfig>;
  eventCount: number;
  lastUpdatedTime: number | null;
}

export interface TranscriptionEvent {
  type: string;
  timestamp: number;
  transcript?: string;
  confidence?: number;
  source?: string;
  interrupted?: boolean;
  userLevel?: number;
  referenceLevel?: number;
  message?: string;
  [key: string]: unknown;
}

export interface TranscriptionRecommendation {
  type: 'RESTART' | 'STOP' | 'CLEANUP' | string;
  reason: string;
  delayMs?: number;
  restartCount?: number;
  maxRestartCount?: number;
  clearInterimTranscript?: boolean;
  clearInterruption?: boolean;
  cancelRestart?: boolean;
  releaseBrowserResources?: boolean;
  [key: string]: unknown;
}

export interface TranscriptionAgency {
  updateConfig(config: TranscriptionConfig): boolean;
  start(): boolean;
  stop(): boolean;
  reset(): boolean;
  processResult(transcript: string, isFinal: boolean, confidence?: number, source?: string): boolean;
  processAudioLevel(userLevel: number, referenceLevel: number, timestamp?: number): boolean;
  fail(message: string): boolean;
  getState(): TranscriptionAgencyState;
  getSnapshot(): TranscriptionSnapshot;
  dispose(): void;
}

export type ConversationStateValue = 'idle' | 'agentSpeaking' | 'interrupted' | 'userSpeaking' | 'processing';

export interface ConversationAgencyConfig {
  autoListen?: boolean;
  useGaze?: boolean;
  useProsody?: boolean;
  useBlink?: boolean;
  interruptionEnabled?: boolean;
}

export interface ConversationAgencyState {
  state: ConversationStateValue;
  turnId: number;
  isRunning: boolean;
  lastAgentText: string | null;
  lastUserText: string | null;
  pendingTranscript: string | null;
  interrupted: boolean;
  interruptionSource: string | null;
}

export interface ConversationSnapshot extends ConversationAgencyState {
  config: Required<ConversationAgencyConfig>;
  eventCount: number;
  lastUpdatedTime: number | null;
}

export interface ConversationEvent {
  type: string;
  timestamp: number;
  turnId?: number;
  text?: string;
  source?: string;
  interrupted?: boolean;
  [key: string]: unknown;
}

export interface ConversationAgency {
  updateConfig(config: ConversationAgencyConfig): boolean;
  start(): boolean;
  stop(): boolean;
  agentStart(text: string): boolean;
  agentEnd(): boolean;
  userSpeech(text: string, isFinal: boolean, interrupted?: boolean): boolean;
  processingComplete(): boolean;
  interrupt(source?: string): boolean;
  getState(): ConversationAgencyState;
  getSnapshot(): ConversationSnapshot;
  dispose(): void;
}

export interface HairColor {
  name: string;
  baseColor: string;
  emissive: string;
  emissiveIntensity: number;
}

export interface HairStyle {
  name: string;
  visible: boolean;
  scale?: number;
  position?: [number, number, number];
}

export interface HairState {
  hairColor: HairColor;
  eyebrowColor: HairColor;
  showOutline: boolean;
  outlineColor: string;
  outlineOpacity: number;
  parts: Record<string, HairStyle>;
}

export interface HairObjectRef {
  name: string;
  isEyebrow: boolean;
  isMesh: boolean;
}

export interface HairObjectState {
  color: {
    baseColor: string;
    emissive: string;
    emissiveIntensity: number;
  };
  outline: {
    show: boolean;
    color: string;
    opacity: number;
  };
  visible: boolean;
  scale?: { x: number; y: number; z: number };
  position?: { x: number; y: number; z: number };
  isEyebrow: boolean;
}

export interface HairObjectStateUpdate {
  name: string;
  objectState: HairObjectState;
}

export interface HairPhysicsRuntimeConfig {
  stiffness: number;
  damping: number;
  inertia: number;
  gravity: number;
  responseScale: number;
  idleSwayAmount: number;
  idleSwaySpeed: number;
  windStrength: number;
  windDirectionX: number;
  windDirectionZ: number;
  windTurbulence: number;
  windFrequency: number;
  idleClipDuration: number;
  impulseClipDuration: number;
}

export type HairPhysicsUIConfig = HairPhysicsRuntimeConfig & {
  enabled: boolean;
};

export interface HairAgencyConfig extends Partial<HairState> {
  state?: Partial<HairState>;
  hairState?: Partial<HairState>;
  objects?: HairObjectRef[];
  physics?: Partial<HairPhysicsUIConfig> & {
    config?: Partial<HairPhysicsRuntimeConfig>;
  };
  physicsEnabled?: boolean;
  physicsConfig?: Partial<HairPhysicsRuntimeConfig>;
}

export type HairEvent =
  | { type: 'SET_HAIR_COLOR'; color: HairColor | keyof HairColorPresetMap }
  | { type: 'SET_EYEBROW_COLOR'; color: HairColor | keyof HairColorPresetMap }
  | { type: 'SET_HAIR_BASE_COLOR'; baseColor: string }
  | { type: 'SET_EYEBROW_BASE_COLOR'; baseColor: string }
  | { type: 'SET_HAIR_GLOW'; emissive: string; intensity: number }
  | { type: 'SET_EYEBROW_GLOW'; emissive: string; intensity: number }
  | { type: 'SET_OUTLINE'; show: boolean; color?: string; opacity?: number }
  | { type: 'SET_PART_VISIBILITY'; partName: string; visible: boolean }
  | { type: 'SET_PART_SCALE'; partName: string; scale: number }
  | { type: 'SET_PART_POSITION'; partName: string; position: [number, number, number] }
  | { type: 'RESET_TO_DEFAULT' };

export interface HairColorPresetMap {
  natural_black: HairColor;
  natural_brown: HairColor;
  natural_blonde: HairColor;
  natural_red: HairColor;
  natural_gray: HairColor;
  natural_white: HairColor;
  neon_blue: HairColor;
  neon_pink: HairColor;
  neon_green: HairColor;
  electric_purple: HairColor;
  fire_orange: HairColor;
}

export interface HairAgencyState {
  hairState: HairState;
  objects: HairObjectRef[];
  physics: {
    enabled: boolean;
    config: HairPhysicsRuntimeConfig;
  };
  lastUpdatedTime: number | null;
}

export interface HairAgency {
  configure(config: HairAgencyConfig): void;
  registerObjects(objects: HairObjectRef[]): void;
  send(event: HairEvent): void;
  setHairColor(color: HairColor | keyof HairColorPresetMap): void;
  setEyebrowColor(color: HairColor | keyof HairColorPresetMap): void;
  setHairBaseColor(baseColor: string): void;
  setEyebrowBaseColor(baseColor: string): void;
  setHairGlow(emissive: string, intensity: number): void;
  setEyebrowGlow(emissive: string, intensity: number): void;
  setOutline(show: boolean, color?: string, opacity?: number): void;
  setPartVisibility(partName: string, visible: boolean): void;
  setPartScale(partName: string, scale: number): void;
  setPartPosition(partName: string, position: [number, number, number]): void;
  resetToDefault(): void;
  setPhysicsEnabled(enabled: boolean): void;
  updatePhysicsConfig(config: Partial<HairPhysicsRuntimeConfig>): void;
  getState(): HairAgencyState;
  getHairState(): HairState;
  getPhysicsConfig(): HairPhysicsUIConfig;
  dispose(): void;
}

export interface WorkerAgencyClient {
  post(command: unknown): void;
  configure(agency: string, config: unknown): void;
  dispose(): void;
}

export interface AnimationWorkerClient {
  loadFromJSON(data: AnimationSnippet): void;
  schedule(snippet: AnimationSnippet, opts?: AnimationScheduleOptions): void;
  updateSnippet(snippet: AnimationSnippet): void;
  remove(name: string): void;
  play(): void;
  pause(): void;
  stop(): void;
  enable(name: string, on?: boolean): void;
  seek(name: string, offsetSec: number): void;
  setSnippetPlaying(name: string, isPlaying: boolean): void;
  setSnippetTime(name: string, time: number): void;
  setSnippetPlaybackRate(name: string, rate: number): void;
  setSnippetIntensityScale(name: string, scale: number): void;
  setSnippetLoopMode(name: string, mode: AnimationLoopMode): void;
  setSnippetReverse(name: string, reverse: boolean): void;
  dispose(): void;
}

export interface BlinkWorkerClient extends Omit<BlinkAgency, 'getState'> {}

export interface GazeWorkerClient {
  configure(config: GazeAgencyConfig): void;
  updateConfig(config: GazeAgencyConfig): void;
  setMode(mode: GazeMode): void;
  setTarget(target: GazeTarget): void;
  schedule(target: GazeTarget): void;
  resetToNeutral(duration?: number): void;
  stop(): void;
  dispose(): void;
}

export interface HairWorkerClient {
  configure(config: HairAgencyConfig): void;
  registerObjects(objects: HairObjectRef[]): void;
  send(event: HairEvent): void;
  setHairColor(color: HairColor | keyof HairColorPresetMap): void;
  setEyebrowColor(color: HairColor | keyof HairColorPresetMap): void;
  setHairBaseColor(baseColor: string): void;
  setEyebrowBaseColor(baseColor: string): void;
  setHairGlow(emissive: string, intensity: number): void;
  setEyebrowGlow(emissive: string, intensity: number): void;
  setOutline(show: boolean, color?: string, opacity?: number): void;
  setPartVisibility(partName: string, visible: boolean): void;
  setPartScale(partName: string, scale: number): void;
  setPartPosition(partName: string, position: [number, number, number]): void;
  resetToDefault(): void;
  setPhysicsEnabled(enabled: boolean): void;
  updatePhysicsConfig(config: Partial<HairPhysicsRuntimeConfig>): void;
  dispose(): void;
}

export interface ProsodicWorkerClient {
  loadBrow(data: ProsodicSnippetInput): void;
  loadHead(data: ProsodicSnippetInput): void;
  updateConfig(config: ProsodicConfig): void;
  startTalking(): void;
  stopTalking(): void;
  pulse(wordIndex: number): void;
  stop(): void;
  dispose(): void;
}

export interface VocalWorkerClient {
  updateConfig(config: VocalConfig): void;
  startTimeline(timeline: VocalTimeline): void;
  startSentence(text: string): void;
  onWordBoundary(word: string, wordIndex?: number, observedElapsedSec?: number): void;
  updateWordTimings(wordTimings: VocalWordTiming[]): void;
  stopSentence(): void;
  pauseSentence(): void;
  resumeSentence(): void;
  speak(text: string): void;
  speakWord(word: string): void;
  processWordBoundary(timing: { word: string; startMs: number; durationMs?: number }): void;
  processVisemeEvents(events: VocalVisemeEvent[], name?: string): void;
  stop(): void;
  dispose(): void;
}

export interface LipSyncWorkerClient {
  startSpeech(): void;
  processWord(word: string, wordIndex: number, actualDurationMs?: number): void;
  processAzureVisemes(
    events: LipSyncAzureVisemeEvent[],
    totalDurationMs?: number,
    options?: { wordTimings?: Array<Record<string, unknown>>; visualLeadMs?: number },
  ): void;
  endSpeech(): void;
  stop(): void;
  updateConfig(config: LipSyncConfig): void;
  dispose(): void;
}

export interface TTSWorkerClient {
  configure(config: TTSAgencyConfig): void;
  updateConfig(config: TTSAgencyConfig): void;
  startSpeech(text: string): void;
  planText(text: string): void;
  planAzureResponse(text: string, response: TTSAzureResponse, durationSec?: number): void;
  playbackStarted(utteranceId?: string): void;
  processWordBoundary(word: string, elapsedSec?: number, utteranceId?: string): void;
  finishSpeech(utteranceId?: string): void;
  pause(): void;
  resume(): void;
  stop(): void;
  fail(message: string): void;
  dispose(): void;
}

export interface TranscriptionWorkerClient {
  configure(config: TranscriptionConfig): void;
  updateConfig(config: TranscriptionConfig): void;
  start(): void;
  stop(): void;
  reset(): void;
  processResult(transcript: string, isFinal: boolean, confidence?: number, source?: string): void;
  processAudioLevel(userLevel: number, referenceLevel: number, timestamp?: number): void;
  fail(message: string): void;
  dispose(): void;
}

export interface ConversationWorkerClient {
  configure(config: ConversationAgencyConfig): void;
  updateConfig(config: ConversationAgencyConfig): void;
  start(): void;
  stop(): void;
  agentStart(text: string): void;
  agentEnd(): void;
  userSpeech(text: string, isFinal: boolean, interrupted?: boolean): void;
  processingComplete(): void;
  interrupt(source?: string): void;
  dispose(): void;
}

export interface EyeHeadTrackingWorkerClient {
  configure(config: EyeHeadTrackingConfig): void;
  updateConfig(config: EyeHeadTrackingConfig): void;
  start(): void;
  setMode(mode: GazeMode): void;
  setGazeTarget(target: GazeTarget): void;
  setTarget(target: GazeTarget): void;
  schedule(target: GazeTarget): void;
  resetToNeutral(duration?: number): void;
  pause(): void;
  resume(): void;
  stop(): void;
  dispose(): void;
}

export interface LatticeworkCljsApi {
  createAnimationAgency(config?: Partial<AnimationAgencyState>, host?: WorkerAgencyHost): AnimationAgency;
  createBlinkAgency(config?: BlinkAgencyConfig, host?: WorkerAgencyHost): BlinkAgency;
  createEyeHeadTrackingAgency(config?: EyeHeadTrackingConfig, host?: WorkerAgencyHost): EyeHeadTrackingAgency;
  createGazeAgency(config?: GazeAgencyConfig, host?: WorkerAgencyHost): GazeAgency;
  createHairAgency(config?: HairAgencyConfig, host?: WorkerAgencyHost): HairAgency;
  createLipSyncAgency(config?: LipSyncConfig, host?: WorkerAgencyHost): LipSyncAgency;
  createProsodicAgency(config?: ProsodicConfig, host?: WorkerAgencyHost): ProsodicAgency;
  createTranscriptionAgency(config?: TranscriptionConfig, host?: WorkerAgencyHost): TranscriptionAgency;
  createTTSAgency(config?: TTSAgencyConfig, host?: WorkerAgencyHost): TTSAgency;
  createConversationAgency(config?: ConversationAgencyConfig, host?: WorkerAgencyHost): ConversationAgency;
  createVocalAgency(config?: VocalConfig, host?: WorkerAgencyHost): VocalAgency;
  createAgencyWorkerClient(worker: Worker, host?: WorkerAgencyHost): WorkerAgencyClient;
  createAnimationWorkerClient(worker: Worker, host?: WorkerAgencyHost): AnimationWorkerClient;
  createBlinkWorkerClient(worker: Worker, host?: WorkerAgencyHost): BlinkWorkerClient;
  createConversationWorkerClient(worker: Worker, host?: WorkerAgencyHost): ConversationWorkerClient;
  createEyeHeadTrackingWorkerClient(worker: Worker, host?: WorkerAgencyHost): EyeHeadTrackingWorkerClient;
  createGazeWorkerClient(worker: Worker, host?: WorkerAgencyHost): GazeWorkerClient;
  createHairWorkerClient(worker: Worker, host?: WorkerAgencyHost): HairWorkerClient;
  createLipSyncWorkerClient(worker: Worker, host?: WorkerAgencyHost): LipSyncWorkerClient;
  createProsodicWorkerClient(worker: Worker, host?: WorkerAgencyHost): ProsodicWorkerClient;
  createTranscriptionWorkerClient(worker: Worker, host?: WorkerAgencyHost): TranscriptionWorkerClient;
  createTTSWorkerClient(worker: Worker, host?: WorkerAgencyHost): TTSWorkerClient;
  createVocalWorkerClient(worker: Worker, host?: WorkerAgencyHost): VocalWorkerClient;
}

export declare function createAnimationAgency(
  config?: Partial<AnimationAgencyState>,
  host?: WorkerAgencyHost,
): AnimationAgency;

export declare function createBlinkAgency(
  config?: BlinkAgencyConfig,
  host?: WorkerAgencyHost,
): BlinkAgency;

export declare function createEyeHeadTrackingAgency(
  config?: EyeHeadTrackingConfig,
  host?: WorkerAgencyHost,
): EyeHeadTrackingAgency;

export declare function createGazeAgency(
  config?: GazeAgencyConfig,
  host?: WorkerAgencyHost,
): GazeAgency;

export declare function createHairAgency(
  config?: HairAgencyConfig,
  host?: WorkerAgencyHost,
): HairAgency;

export declare function createLipSyncAgency(
  config?: LipSyncConfig,
  host?: WorkerAgencyHost,
): LipSyncAgency;

export declare function createProsodicAgency(
  config?: ProsodicConfig,
  host?: WorkerAgencyHost,
): ProsodicAgency;

export declare function createTranscriptionAgency(
  config?: TranscriptionConfig,
  host?: WorkerAgencyHost,
): TranscriptionAgency;

export declare function createTTSAgency(
  config?: TTSAgencyConfig,
  host?: WorkerAgencyHost,
): TTSAgency;

export declare function createConversationAgency(
  config?: ConversationAgencyConfig,
  host?: WorkerAgencyHost,
): ConversationAgency;

export declare function createVocalAgency(
  config?: VocalConfig,
  host?: WorkerAgencyHost,
): VocalAgency;

export declare function createAgencyWorkerClient(
  worker: Worker,
  host?: WorkerAgencyHost,
): WorkerAgencyClient;

export declare function createAnimationWorkerClient(
  worker: Worker,
  host?: WorkerAgencyHost,
): AnimationWorkerClient;

export declare function createBlinkWorkerClient(
  worker: Worker,
  host?: WorkerAgencyHost,
): BlinkWorkerClient;

export declare function createConversationWorkerClient(
  worker: Worker,
  host?: WorkerAgencyHost,
): ConversationWorkerClient;

export declare function createEyeHeadTrackingWorkerClient(
  worker: Worker,
  host?: WorkerAgencyHost,
): EyeHeadTrackingWorkerClient;

export declare function createGazeWorkerClient(
  worker: Worker,
  host?: WorkerAgencyHost,
): GazeWorkerClient;

export declare function createHairWorkerClient(
  worker: Worker,
  host?: WorkerAgencyHost,
): HairWorkerClient;

export declare function createLipSyncWorkerClient(
  worker: Worker,
  host?: WorkerAgencyHost,
): LipSyncWorkerClient;

export declare function createProsodicWorkerClient(
  worker: Worker,
  host?: WorkerAgencyHost,
): ProsodicWorkerClient;

export declare function createTranscriptionWorkerClient(
  worker: Worker,
  host?: WorkerAgencyHost,
): TranscriptionWorkerClient;

export declare function createTTSWorkerClient(
  worker: Worker,
  host?: WorkerAgencyHost,
): TTSWorkerClient;

export declare function createVocalWorkerClient(
  worker: Worker,
  host?: WorkerAgencyHost,
): VocalWorkerClient;

export declare function installLatticework(target?: typeof globalThis): LatticeworkCljsApi;
