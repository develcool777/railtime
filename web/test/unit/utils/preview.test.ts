import { describe, expect, test } from 'vitest';
import { previewPathsOf } from '../../../app/utils/preview.utils';
import { planOnlyNetwork } from '../../support/factories/planOnlyNetwork.utils';

describe('PreviewUtils', () => {
  describe('previewPathsOf', () => {
    test("draws a network never built as its first plan, in the plan's colours", () => {
      const paths = previewPathsOf(planOnlyNetwork());
      expect(paths).toHaveLength(2);
      expect(paths.every(path => path.color === '#ff0000')).toBe(true);
    });
  });
});
