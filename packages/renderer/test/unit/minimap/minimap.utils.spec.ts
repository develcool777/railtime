import { describe, expect, test } from 'vitest';
import { MINIMAP_VIEWPORT_MIN_PX } from '../../../src/minimap/minimap.constants';
import { viewportBox } from '../../../src/minimap/minimap.utils';

describe('MinimapUtils', () => {
  describe('viewportBox', () => {
    test("outlines the view's projected corners", () => {
      expect(viewportBox({ x: 10, y: 20 }, { x: 50, y: 45 })).toEqual({ left: 10, top: 20, width: 40, height: 25 });
    });

    test('keeps a view closer in than a few pixels visible, centred where it is', () => {
      expect(viewportBox({ x: 30, y: 30 }, { x: 31, y: 30.5 })).toEqual({
        left: 30.5 - MINIMAP_VIEWPORT_MIN_PX / 2,
        top: 30.25 - MINIMAP_VIEWPORT_MIN_PX / 2,
        width: MINIMAP_VIEWPORT_MIN_PX,
        height: MINIMAP_VIEWPORT_MIN_PX,
      });
    });
  });
});
