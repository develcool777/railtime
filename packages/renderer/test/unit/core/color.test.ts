import { describe, expect, test } from 'vitest';
import { channelsOf } from '../../../src/core/color.utils';

describe('ColorUtils', () => {
  describe('channelsOf', () => {
    test("reads a colour's red, green and blue", () => {
      expect(channelsOf('#0b7aff')).toEqual([0x0b, 0x7a, 0xff]);
    });
  });
});
