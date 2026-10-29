import { describe, expect, test } from 'vitest';
import { cityNetwork, playPlan, playWholeHistory } from '../../../support/history.utils';

describe('Prague', () => {
  test('plays its whole history, every step, drawing frames without errors', () => {
    const played = playWholeHistory(cityNetwork('prague'));
    expect(played.started).toBe(played.steps);
    expect(played.cursor).toBe(played.steps);
  });

  test.each(['line-d', 'line-d-extensions', 'line-a-airport', 'line-a-hostivar', 'line-c-cakovice', 'line-b-west', 'line-o-2022', 'study-1987'])(
    'plays on through its %s plan, section by section',
    plan => {
      const played = playPlan(cityNetwork('prague'), plan);
      expect(played.steps).toBeGreaterThan(0);
      expect(played.started).toBe(played.steps);
      expect(played.cursor).toBe(played.steps);
    },
  );
});
