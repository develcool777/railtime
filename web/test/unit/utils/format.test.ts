import { describe, expect, test } from 'vitest';
import { formatSpan, sourceLabel } from '../../../app/utils/format.utils';

describe('FormatUtils', () => {
  describe('formatSpan', () => {
    test('says when a line served a station, or when it is planned to', () => {
      expect(formatSpan('1906-03-10', undefined, '2026-10-29')).toBe('since 1906');
      expect(formatSpan('1906-03-10', '1994-09-30', '2026-10-29')).toBe('1906–1994');
      expect(formatSpan('2030-12-31', undefined, '2026-10-29')).toBe('planned 2030');
    });
  });

  describe('sourceLabel', () => {
    test('names a source by its site and page, or its site alone when the page is a number', () => {
      expect(
        sourceLabel('https://uk.wikipedia.org/wiki/%D0%93%D1%96%D0%B4%D1%80%D0%BE%D0%BF%D0%B0%D1%80%D0%BA_(%D1%81%D1%82%D0%B0%D0%BD%D1%86%D1%96%D1%8F)'),
      ).toBe('uk.wikipedia.org · Гідропарк (станція)');
      expect(sourceLabel('https://www.openstreetmap.org/way/646882762')).toBe('openstreetmap.org');
      expect(sourceLabel('https://example.com/')).toBe('example.com');
    });
  });
});
