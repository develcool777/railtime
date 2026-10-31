import { describe, expect, test } from 'vitest';
import { SECTIONS } from '~/features/explorer/explorer.constants';
import { SHORTCUTS } from '~/features/explorer/shortcuts.constants';

describe('Shortcuts', () => {
  test('gives each key one action, and none of the number keys the sections take', () => {
    const keys = SHORTCUTS.map(shortcut => shortcut.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(SHORTCUTS.map(shortcut => shortcut.action)).size).toBe(SHORTCUTS.length);
    const sectionKeys = SECTIONS.map((_, position) => String(position + 1));
    expect(keys.filter(key => sectionKeys.includes(key))).toEqual([]);
  });
});
