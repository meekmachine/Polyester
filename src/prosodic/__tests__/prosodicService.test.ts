import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createProsodicService, type ProsodicServiceAPI } from '../prosodicService';

function createStorageMock(seed: Record<string, string> = {}) {
  const data = { ...seed };

  return {
    data,
    getItem: vi.fn((key: string) => data[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      data[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete data[key];
    }),
  };
}

describe('createProsodicService', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let service: ProsodicServiceAPI | null;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    service = null;
  });

  afterEach(() => {
    service?.dispose();
    vi.unstubAllGlobals();
    warnSpy.mockRestore();
  });

  it('preserves inherited keyframes when scheduling head nod snippets', () => {
    const storage = createStorageMock({
      'speakingAnimationsList/headNodSmall': JSON.stringify({
        name: 'headNodSmall',
        curves: {
          '53': [
            { time: 0, intensity: 0, inherit: true },
            { time: 0.15, intensity: 0.4 },
            { time: 0.4, intensity: 0 },
          ],
        },
      }),
    });
    const scheduled: any[] = [];

    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('window', { localStorage: storage });

    service = createProsodicService(
      { headLoopKey: 'speakingAnimationsList/headNodSmall' },
      {},
      {
        scheduleSnippet: (snippet) => {
          scheduled.push(snippet);
          return snippet.name;
        },
        removeSnippet: vi.fn(),
      },
    );

    service.startTalking();

    expect(scheduled).toHaveLength(1);
    expect(scheduled[0].curves['53'][0]).toEqual({ time: 0, intensity: 0, inherit: true });
  });
});
