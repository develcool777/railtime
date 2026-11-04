import type { CoverageInfo } from '@railtime/network/facts.types';
import { describe, expect, test } from 'vitest';
import { foundCoverageOf } from '~/utils/overlay.utils';

describe('OverlayUtils', () => {
  describe('foundCoverageOf', () => {
    test('takes the coverage the map found, and nothing for another overlay or none', () => {
      const coverage: CoverageInfo = { name: 'Test', source: 'test', km2: 4, metres: 800, share: 0.5, bands: [], beyond: { share: 0.5, km2: 2 } };
      expect(foundCoverageOf({ kind: 'coverage', coverage })).toBe(coverage);
      expect(foundCoverageOf({ kind: 'coverage', coverage: null })).toBeNull();
      expect(foundCoverageOf({ kind: 'reach', reach: null })).toBeNull();
      expect(foundCoverageOf(null)).toBeNull();
    });
  });
});
