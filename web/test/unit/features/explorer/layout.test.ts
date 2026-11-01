import { describe, expect, test } from 'vitest';
import { PANEL_WIDTH, SHEET_HEIGHTS, TAB_LABELS_HEIGHT } from '~/features/explorer/explorer.constants';
import { draggedPanelWidth, mapPaddingFor, sheetHeightOf } from '~/features/explorer/layout.utils';

describe('LayoutUtils', () => {
  describe('mapPaddingFor', () => {
    test('keeps more room at the bottom as the time control grows', () => {
      const bottoms = (['rest', 'timeline', 'playing'] as const).map(mode => mapPaddingFor(mode, null).bottom);
      expect(bottoms).toEqual([...bottoms].sort((first, second) => first - second));
      expect(new Set(bottoms).size).toBe(3);
    });

    test('on a phone, adds what the sheet covers', () => {
      expect(mapPaddingFor('rest', 200).bottom - mapPaddingFor('rest', 100).bottom).toBe(100);
    });
  });

  describe('sheetHeightOf', () => {
    test("stands the sheet at its snap; at full height, the half it is let down to; taller by its tabs' names where they show", () => {
      expect(sheetHeightOf('peek', false)).toBe(SHEET_HEIGHTS.peek);
      expect(sheetHeightOf('peek', true)).toBe(SHEET_HEIGHTS.peek + TAB_LABELS_HEIGHT);
      expect(sheetHeightOf('half', true)).toBe(SHEET_HEIGHTS.half);
      expect(sheetHeightOf('full', false)).toBe(SHEET_HEIGHTS.half);
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
