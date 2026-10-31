import { describe, expect, test } from 'vitest';
import { byZoom, highlightedWidth, sideBySideOffset } from '../../../src/layers/style.utils';

describe('LayerStyleUtils', () => {
  describe('byZoom', () => {
    test('interpolates from the whole city at zoom 10 to a neighbourhood at 14', () => {
      expect(byZoom(1, 3)).toEqual(['interpolate', ['linear'], ['zoom'], 10, 1, 14, 3]);
    });
  });

  describe('highlightedWidth', () => {
    test("widens with the feature's highlight, by less at street zoom", () => {
      expect(highlightedWidth(2, 5)).toEqual(byZoom(['+', 2, ['*', ['get', 'highlight'], 1.6]], ['+', 5, ['*', ['get', 'highlight'], 3]]));
    });
  });

  describe('sideBySideOffset', () => {
    test("moves a line by its slot, about a line's width a slot", () => {
      expect(sideBySideOffset()).toEqual(byZoom(['*', ['get', 'offset'], 2.4], ['*', ['get', 'offset'], 6]));
    });
  });
});
