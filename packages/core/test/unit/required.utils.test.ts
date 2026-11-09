import { describe, expect, test } from 'vitest';
import { required } from '../../src/required.utils';

describe('RequiredUtils', () => {
  describe('required', () => {
    test('hands back a value that is there, falsy ones too, and fails loudly on one that is not', () => {
      expect(required(0, 'count')).toBe(0);
      expect(required(null, 'nothing')).toBeNull();
      expect(() => required(undefined, 'station x')).toThrow('Missing station x');
    });
  });
});
