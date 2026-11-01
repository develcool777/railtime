import { describe, expect, test } from 'vitest';
import { slugOf } from '../../src/text.utils';

describe('TextUtils', () => {
  describe('slugOf', () => {
    test('lowers a name and joins its words with hyphens', () => {
      expect([slugOf('United Kingdom'), slugOf('Czechia'), slugOf(' Bosnia  and Herzegovina ')]).toEqual([
        'united-kingdom',
        'czechia',
        'bosnia-and-herzegovina',
      ]);
    });
  });
});
