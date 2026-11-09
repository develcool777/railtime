import { describe, expect, test } from 'vitest';
import { lineColorOf } from '../../../src/engine/lineColor.utils';

describe('LineColorUtils', () => {
  describe('lineColorOf', () => {
    test('gives a line its dark colour on dark backgrounds, if it has one', () => {
      expect(lineColorOf({ color: '#000000', darkColor: '#ffffff' })).toEqual({ light: '#000000', dark: '#ffffff' });
    });

    test('gives a line with none its own colour in both themes', () => {
      expect(lineColorOf({ color: '#ff0000' })).toEqual({ light: '#ff0000', dark: '#ff0000' });
    });
  });
});
