import { describe, expect, test } from 'vitest';
import { openExplorer } from '@test/support/factories/explorer.utils';
import { SHEET_HEIGHTS, TAB_LABELS_HEIGHT } from '~/features/explorer/explorer.constants';
import { useLayoutStore } from '~/features/explorer/layout.store';

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
