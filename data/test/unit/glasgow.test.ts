import { describe, expect, test } from 'vitest';
import { cityNetwork, playWholeHistory } from '../support/history.utils';

describe('Glasgow', () => {
  test('plays its whole history, every step, drawing frames without errors', () => {
    const played = playWholeHistory(cityNetwork('glasgow'));
    expect(played.started).toBe(played.steps);
    expect(played.cursor).toBe(played.steps);
  });

  test.each(['long-term-strategy-2010', 'stds-1988', 'halcrow-1954', 'eastern-circle-1944', 'extensions-1937'])(
    'plays on through its %s plan, section by section',
    plan => {
      const played = playWholeHistory(cityNetwork('glasgow'), plan);
      expect(played.started).toBe(played.steps);
      expect(played.cursor).toBe(played.steps);
      expect(played.steps).toBeGreaterThan(playWholeHistory(cityNetwork('glasgow')).steps);
    },
  );
});
