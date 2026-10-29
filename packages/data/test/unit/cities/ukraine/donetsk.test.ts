import { describe, expect, test } from 'vitest';
import { cityNetwork, playWholeHistory } from '../../../support/history.utils';

describe('Donetsk', () => {
  test.each(['soviet-project'])('plays its %s plan, section by section, drawing frames without errors', plan => {
    const played = playWholeHistory(cityNetwork('donetsk'), plan);
    expect(played.steps).toBeGreaterThan(0);
    expect(played.started).toBe(played.steps);
    expect(played.cursor).toBe(played.steps);
  });
});
