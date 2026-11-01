import type { ScreenBox, ScreenPoint } from './minimap.types';
import { MINIMAP_VIEWPORT_MIN_PX } from './minimap.constants';

/**
 * Where the box outlining the main camera's view goes on the minimap, from its corners as the minimap
 * projects them: never smaller than can be seen, kept centred where the view is.
 *
 * @param topLeft - The view's north-west corner, minimap pixels.
 * @param bottomRight - Its south-east corner.
 * @returns The box, pixels.
 */
export const viewportBox = (topLeft: ScreenPoint, bottomRight: ScreenPoint): ScreenBox => {
  const width = Math.max(bottomRight.x - topLeft.x, MINIMAP_VIEWPORT_MIN_PX);
  const height = Math.max(bottomRight.y - topLeft.y, MINIMAP_VIEWPORT_MIN_PX);
  return { left: (topLeft.x + bottomRight.x - width) / 2, top: (topLeft.y + bottomRight.y - height) / 2, width, height };
};
