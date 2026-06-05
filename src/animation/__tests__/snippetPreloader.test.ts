import { describe, expect, it, vi } from 'vitest';
import {
  getAvailableSnippetNames,
  getBundledSnippetNames,
  resolveSnippetEntry,
} from '../snippetPreloader';

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

describe('snippetPreloader', () => {
  it('exposes bundled snippet names without reading localStorage', () => {
    expect(getBundledSnippetNames('emotionAnimationsList')).toContain('skeptical');
    expect(getBundledSnippetNames('speakingAnimationsList')).toContain('headNodSmall');
  });

  it('merges bundled names with custom localStorage names without duplicates', () => {
    const storage = createStorageMock({
      emotionAnimationsList: JSON.stringify(['skeptical', 'customEmotion']),
    });

    const names = getAvailableSnippetNames('emotionAnimationsList', storage);

    expect(names).toContain('skeptical');
    expect(names).toContain('customEmotion');
    expect(names.filter((name) => name === 'skeptical')).toHaveLength(1);
  });

  it('prefers custom localStorage data over bundled snippets when names collide', async () => {
    const storage = createStorageMock({
      'emotionAnimationsList/skeptical': JSON.stringify({
        name: 'skeptical',
        snippetPriority: 999,
        curves: { test: [{ time: 0, intensity: 1 }] },
      }),
    });

    const resolved = await resolveSnippetEntry('emotionAnimationsList', 'skeptical', storage);

    expect(resolved?.source).toBe('localStorage');
    expect(resolved?.data.snippetPriority).toBe(999);
  });

  it('loads bundled snippet data lazily without writing localStorage', async () => {
    const storage = createStorageMock({
      emotionAnimationsList: JSON.stringify(['customEmotion']),
    });

    const resolved = await resolveSnippetEntry('emotionAnimationsList', 'skeptical', storage);

    expect(resolved?.source).toBe('bundled');
    expect(resolved?.name).toBe('skeptical');
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.removeItem).not.toHaveBeenCalled();
  });

  it('anchors bundled head nod snippets to the inherited live head pose', async () => {
    for (const name of ['headNodSmall', 'headNodBig']) {
      const resolved = await resolveSnippetEntry('speakingAnimationsList', name);
      const curves = resolved?.data.curves as Record<string, Array<{ inherit?: boolean }>> | undefined;

      expect(resolved?.source).toBe('bundled');
      expect(curves?.['54']?.[0]).toMatchObject({ inherit: true });
      expect(curves?.['53']?.[0]).toMatchObject({ inherit: true });
    }
  });

  it('ignores legacy preloaded bundle entries when reading custom snippet names', () => {
    const storage = createStorageMock({
      bundledAnimationSnippetsManifest: JSON.stringify({
        emotionAnimationsList: ['skeptical'],
      }),
      emotionAnimationsList: JSON.stringify(['skeptical', 'customEmotion']),
    });

    const names = getAvailableSnippetNames('emotionAnimationsList', storage);

    expect(names).toContain('skeptical');
    expect(names).toContain('customEmotion');
    expect(names.filter((name) => name === 'skeptical')).toHaveLength(1);
  });
});
