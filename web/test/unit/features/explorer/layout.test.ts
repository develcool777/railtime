import { describe, expect, test } from 'vitest';
import { PANEL_WIDTH, SHEET_HEIGHTS } from '~/features/explorer/explorer.constants';
import { draggedPanelWidth, mapPaddingFor } from '~/features/explorer/layout.utils';

describe('LayoutUtils', () => {
  describe('mapPaddingFor', () => {
    test('keeps more room at the bottom as the time control grows', () => {
      const bottoms = (['rest', 'timeline', 'playing'] as const).map(mode => mapPaddingFor(mode, false, 'peek').bottom);
      expect(bottoms).toEqual([...bottoms].sort((first, second) => first - second));
      expect(new Set(bottoms).size).toBe(3);
    });

    test('on a phone, adds the sheet; at full height, the half it is let down to', () => {
      const peek = mapPaddingFor('rest', true, 'peek').bottom;
      const half = mapPaddingFor('rest', true, 'half').bottom;
      expect(half - peek).toBe(SHEET_HEIGHTS.half - SHEET_HEIGHTS.peek);
      expect(mapPaddingFor('rest', true, 'full')).toEqual(mapPaddingFor('rest', true, 'half'));
    });

    test('beside the map, the sheet does not count', () => {
      expect(mapPaddingFor('timeline', false, 'peek')).toEqual(mapPaddingFor('timeline', false, 'full'));
    });
  });

  describe('draggedPanelWidth', () => {
    test('follows the pointer, in whole pixels', () => {
      expect(draggedPanelWidth(340, 20.4)).toBe(360);
      expect(draggedPanelWidth(340, -20)).toBe(320);
    });

    test('stops at the least and greatest width', () => {
      expect(draggedPanelWidth(340, -500)).toBe(PANEL_WIDTH.min);
      expect(draggedPanelWidth(340, 500)).toBe(PANEL_WIDTH.max);
    });
  });
});
