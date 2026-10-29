import { describe, expect, test } from 'vitest';
import { cityNetwork, playPlan, playWholeHistory } from '../../../support/history.utils';

describe('Warsaw', () => {
  test('plays its whole history, every step, drawing frames without errors', () => {
    const played = playWholeHistory(cityNetwork('warsaw'));
    expect(played.started).toBe(played.steps);
    expect(played.cursor).toBe(played.steps);
  });

  test.each(['under-construction', 'm1-infill', 'm3-first-stage', 'five-lines-2050', 'deep-metro-1950s', 'metropolitan-1927'])(
    'plays on through its %s plan, section by section',
    plan => {
      const played = playPlan(cityNetwork('warsaw'), plan);
      expect(played.steps).toBeGreaterThan(0);
      expect(played.started).toBe(played.steps);
      expect(played.cursor).toBe(played.steps);
    },
  );
});
