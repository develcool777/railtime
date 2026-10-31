import { describe, expect, test } from 'vitest';
import { OPENING_MAX_ZOOM, OPENING_SIDE_PADDING } from '../../src/transitMap.constants';
import { openingOf } from '../../src/transitMap.utils';

describe('TransitMapUtils', () => {
  describe('openingOf', () => {
    const bounds: [[number, number], [number, number]] = [
      [0, 51],
      [1, 52],
    ];

    test('opens on a linked view as it is', () => {
      expect(openingOf({ center: [0.5, 51.5], zoom: 12 }, bounds, { top: 1, bottom: 2, left: 3, right: 4 }, { top: 0, bottom: 0, left: 0, right: 0 })).toEqual({
        center: [0.5, 51.5],
        zoom: 12,
      });
    });

    test('else fits the network clear of the padding above and below, narrow at the sides, and of every panel over the map', () => {
      expect(openingOf(undefined, bounds, { top: 10, bottom: 20, left: 300, right: 300 }, { top: 1, bottom: 2, left: 3, right: 4 })).toEqual({
        bounds,
        fitBoundsOptions: {
          padding: { top: 11, bottom: 22, left: OPENING_SIDE_PADDING + 3, right: OPENING_SIDE_PADDING + 4 },
          maxZoom: OPENING_MAX_ZOOM,
        },
      });
    });
  });
});
