import { describe, expect, test } from 'vitest';
import { cityNetwork, playWholeHistory } from '../support/history.utils';

describe('Bristol', () => {
  test.each(['supertram', 'mass-transit'])('plays its %s plan, section by section, drawing frames without errors', plan => {
    const played = playWholeHistory(cityNetwork('bristol'), plan);
    expect(played.steps).toBeGreaterThan(0);
    expect(played.started).toBe(played.steps);
    expect(played.cursor).toBe(played.steps);
  });
});
