import { describe, expect, test } from 'vitest';
import { cityNetwork, playWholeHistory } from '../support/history.utils';

describe('Manchester', () => {
  test('plays its whole history, every step, drawing frames without errors', () => {
    const played = playWholeHistory(cityNetwork('manchester'));
    expect(played.started).toBe(played.steps);
    expect(played.cursor).toBe(played.steps);
    expect(played.mostHighlighted).toBeGreaterThan(5);
  });

  test.each(['picc-vic', 'bee-network-2040'])('plays on through its %s plan, section by section', plan => {
    const played = playWholeHistory(cityNetwork('manchester'), plan);
    expect(played.started).toBe(played.steps);
    expect(played.cursor).toBe(played.steps);
    expect(played.steps).toBeGreaterThan(playWholeHistory(cityNetwork('manchester')).steps);
  });
});
