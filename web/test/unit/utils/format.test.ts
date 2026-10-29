import { describe, expect, test } from 'vitest';
import { formatPlanFacts, formatSpan } from '../../../app/utils/format.utils';

describe('FormatUtils', () => {
  describe('formatSpan', () => {
    test('says when a line served a station, or when it is planned to', () => {
      expect(formatSpan('1906-03-10')).toBe('since 1906');
      expect(formatSpan('1906-03-10', '1994-09-30')).toBe('1906–1994');
      expect(formatSpan(null)).toBe('planned');
    });
  });

  describe('formatPlanFacts', () => {
    test('says what a plan adds, leaving out what it adds none of', () => {
      expect(formatPlanFacts(4, 6.2)).toBe('+4 stations · +6 km');
      expect(formatPlanFacts(1, 0.2)).toBe('+1 station');
      expect(formatPlanFacts(0, 3)).toBe('+3 km');
    });
  });
});
