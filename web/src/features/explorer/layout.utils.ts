import type { Padding } from '@railtime/renderer/transitMap.types';

import { PANEL_WIDTH, SHEET_HEIGHTS } from '~/features/explorer/explorer.constants';
import type { SheetSnap, TimeMode } from '~/features/explorer/explorer.types';

/** How tall the time control stands in each of its sizes, pixels, for the room the camera keeps clear of it. */
const TIME_CONTROL_HEIGHTS: Record<TimeMode, number> = { rest: 80, timeline: 130, playing: 150 };

/**
 * Room the camera keeps clear of the cards on the map: the tools at the top right, the time control
 * at the bottom; on a phone, the sheet too (at full height, the half it covers when let down).
 *
 * @param mode - What the time control shows.
 * @param phone - Whether the layout is the phone's.
 * @param sheet - How high the phone's sheet stands.
 * @returns The padding.
 */
export const mapPaddingFor = (mode: TimeMode, phone: boolean, sheet: SheetSnap): Padding => {
  const timeControl = TIME_CONTROL_HEIGHTS[mode];
  if (phone) return { top: 24, right: 64, left: 24, bottom: SHEET_HEIGHTS[sheet === 'full' ? 'half' : sheet] + timeControl - 20 };
  return { top: 64, right: 72, left: 48, bottom: timeControl };
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
export const draggedPanelWidth = (startWidth: number, moved: number): number =>
  Math.round(Math.min(Math.max(startWidth + moved, PANEL_WIDTH.min), PANEL_WIDTH.max));
