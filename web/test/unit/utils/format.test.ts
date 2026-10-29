import { describe, expect, test } from 'vitest';
import { formatSpan } from '../../../app/utils/format.utils';

describe('FormatUtils', () => {
  describe('formatSpan', () => {
    test('says when a line served a station, or when it is planned to', () => {
      expect(formatSpan('1906-03-10')).toBe('since 1906');
      expect(formatSpan('1906-03-10', '1994-09-30')).toBe('1906–1994');
      expect(formatSpan(null)).toBe('planned');
    });
  });
});
