import { describe, expect, test } from 'vitest';
import { openExplorer } from '@test/support/factories/explorer.utils';
import { PANEL_WIDTH, SHEET_HEIGHTS, TAB_LABELS_HEIGHT } from '~/features/explorer/explorer.constants';
import { useLayoutStore } from '~/features/explorer/layout.store';
import { draggedPanelWidth, mapPaddingFor, panelCoverOf, sheetHeightOf } from '~/features/explorer/layout.utils';

describe('LayoutUtils', () => {
  describe('mapPaddingFor', () => {
    test('keeps room at the bottom for the time control, more than at the top for the tools', () => {
      const padding = mapPaddingFor(null);
      expect(padding.bottom).toBeGreaterThan(padding.top);
    });

    test('on a phone, adds what the sheet covers', () => {
      expect(mapPaddingFor(200).bottom - mapPaddingFor(100).bottom).toBe(100);
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

  describe('panelCoverOf', () => {
    test('covers its width while open beside the map', () => {
      expect(panelCoverOf({ phone: false, mapOnly: false, panelOpen: true, panelWidth: 360 })).toBe(360);
    });

    test('covers nothing on a phone, in map only, or folded', () => {
      const open = { phone: false, mapOnly: false, panelOpen: true, panelWidth: 360 };
      expect([panelCoverOf({ ...open, phone: true }), panelCoverOf({ ...open, mapOnly: true }), panelCoverOf({ ...open, panelOpen: false })]).toEqual([
        0, 0, 0,
      ]);
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

describe('LayoutStore', () => {
  test('stands the sheet only on a phone, taller by its tabs where they show', () => {
    openExplorer();
    const layout = useLayoutStore();
    expect(layout.sheetHeight).toBeNull();
    layout.SET_SCREEN({ phone: true, tabLabels: true });
    expect(layout.sheetHeight).toBe(SHEET_HEIGHTS.peek + TAB_LABELS_HEIGHT);
    layout.SET_SHEET('full');
    expect(layout.sheetHeight).toBe(SHEET_HEIGHTS.half);
  });

  test('raises the sheet from its tabs alone, and leaves it where it stands higher', () => {
    openExplorer();
    const layout = useLayoutStore();
    layout.RAISE_SHEET();
    expect(layout.sheet).toBe('half');
    layout.SET_SHEET('full');
    layout.RAISE_SHEET();
    expect(layout.sheet).toBe('full');
  });

  test('keeps what a drag set, and puts the sheet down as a page opens, the width dragged staying', () => {
    openExplorer();
    const layout = useLayoutStore();
    layout.SET_RESIZING(true);
    layout.SET_PANEL_WIDTH(400);
    layout.SET_SHEET('half');
    layout.OPEN();
    expect([layout.resizing, layout.panelWidth, layout.sheet]).toEqual([true, 400, 'peek']);
  });

  test("gives the explorer the panel's width, which covers the map beside it, and none on a phone", () => {
    const explorer = openExplorer();
    useLayoutStore().SET_PANEL_WIDTH(400);
    expect(explorer.panelCover).toBe(400);
    useLayoutStore().SET_SCREEN({ phone: true, tabLabels: false });
    expect(explorer.panelCover).toBe(0);
  });
});
