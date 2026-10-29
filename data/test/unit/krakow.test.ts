import { describe, expect, test } from 'vitest';
import { cityNetwork, playWholeHistory } from '../support/history.utils';

describe('Kraków', () => {
  test.each(['central-section-2025', 'metro-2025'])('plays its %s plan, section by section, drawing frames without errors', plan => {
    const played = playWholeHistory(cityNetwork('krakow'), plan);
    expect(played.steps).toBeGreaterThan(0);
    expect(played.started).toBe(played.steps);
    expect(played.cursor).toBe(played.steps);
  });
});
