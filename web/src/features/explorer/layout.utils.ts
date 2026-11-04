import { clamp } from '@railtime/core/number.utils';
import type { Padding } from '@railtime/renderer/transitMap.types';
import { PANEL_WIDTH, SHEET_HEIGHTS, TAB_LABELS_HEIGHT } from '~/features/explorer/explorer.constants';
import type { SheetSnap } from '~/features/explorer/explorer.types';

/** How tall the time control stands, pixels, for the room the camera keeps clear of it: one card, the same size playing or not. */
const TIME_CONTROL_HEIGHT = { desk: 130, phone: 120 };

/**
 * How much of the map's foot the phone's sheet covers: at full height, the half it is let down to.
 *
 * @param sheet - How high it stands.
 * @param tabLabels - Whether its tabs show their names, under their icons.
 * @returns Pixels.
 */
export const sheetHeightOf = (sheet: SheetSnap, tabLabels: boolean): number => {
  if (sheet !== 'peek') return SHEET_HEIGHTS.half;
  return tabLabels ? SHEET_HEIGHTS.peek + TAB_LABELS_HEIGHT : SHEET_HEIGHTS.peek;
};

/**
 * Room the camera keeps clear of the cards on the map: the tools at the top right, the time control
 * at the bottom; on a phone, the sheet too.
 *
 * @param sheetHeight - How much of the map's foot the phone's sheet covers (`sheetHeightOf`); `null` beside the map.
 * @returns The padding.
 */
export const mapPaddingFor = (sheetHeight: number | null): Padding => {
  if (sheetHeight !== null) return { top: 24, right: 64, left: 24, bottom: sheetHeight + TIME_CONTROL_HEIGHT.phone - 20 };
  return { top: 64, right: 72, left: 48, bottom: TIME_CONTROL_HEIGHT.desk };
};

/**
 * How much of the map's left the panel covers: its width while open beside the map; none on a phone
 * (a sheet over the foot), in map only, or folded.
 *
 * @param layout - The layout.
 * @param layout.phone - Whether it is the phone's.
 * @param layout.mapOnly - Whether only the map shows.
 * @param layout.panelOpen - Whether the panel is open.
 * @param layout.panelWidth - Its width, pixels.
 * @returns Pixels.
 */
export const panelCoverOf = (layout: { phone: boolean; mapOnly: boolean; panelOpen: boolean; panelWidth: number }): number =>
  layout.phone || layout.mapOnly || !layout.panelOpen ? 0 : layout.panelWidth;

/**
 * The panel's width as its edge is dragged, kept between its least and greatest.
 *
 * @param startWidth - Its width when the drag began, pixels.
 * @param moved - How far the pointer has moved since, pixels; rightwards is positive.
 * @returns The width, a whole number of pixels.
 */
export const draggedPanelWidth = (startWidth: number, moved: number): number => Math.round(clamp(startWidth + moved, PANEL_WIDTH.min, PANEL_WIDTH.max));
