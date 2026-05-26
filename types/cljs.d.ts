export interface WorkerAgencyOutput {
  type: string;
  agency: string;
  [key: string]: unknown;
}

export interface WorkerAgencyHost {
  scheduleSnippet?: (snippet: unknown, opts?: { autoPlay?: boolean }) => string | null;
  removeSnippet?: (name: string) => void;
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

export interface LatticeworkCljsApi {
  createBlinkAgency(config?: BlinkAgencyConfig, host?: WorkerAgencyHost): BlinkAgency;
  createGazeAgency(config?: GazeAgencyConfig, host?: WorkerAgencyHost): GazeAgency;
  createHairAgency(config?: HairAgencyConfig, host?: WorkerAgencyHost): HairAgency;
  createAgencyWorkerClient(worker: Worker, host?: WorkerAgencyHost): WorkerAgencyClient;
  createBlinkWorkerClient(worker: Worker, host?: WorkerAgencyHost): BlinkWorkerClient;
  createGazeWorkerClient(worker: Worker, host?: WorkerAgencyHost): GazeWorkerClient;
  createHairWorkerClient(worker: Worker, host?: WorkerAgencyHost): HairWorkerClient;
}

export declare function createBlinkAgency(
  config?: BlinkAgencyConfig,
  host?: WorkerAgencyHost,
): BlinkAgency;

export declare function createGazeAgency(
  config?: GazeAgencyConfig,
  host?: WorkerAgencyHost,
): GazeAgency;

export declare function createHairAgency(
  config?: HairAgencyConfig,
  host?: WorkerAgencyHost,
): HairAgency;

export declare function createAgencyWorkerClient(
  worker: Worker,
  host?: WorkerAgencyHost,
): WorkerAgencyClient;

export declare function createBlinkWorkerClient(
  worker: Worker,
  host?: WorkerAgencyHost,
): BlinkWorkerClient;

export declare function createGazeWorkerClient(
  worker: Worker,
  host?: WorkerAgencyHost,
): GazeWorkerClient;

export declare function createHairWorkerClient(
  worker: Worker,
  host?: WorkerAgencyHost,
): HairWorkerClient;

export declare function installLatticework(target?: typeof globalThis): LatticeworkCljsApi;
