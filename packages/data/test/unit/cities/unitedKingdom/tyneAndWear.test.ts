import { describe, expect, test } from 'vitest';
import { cityNetwork, playPlan, playWholeHistory } from '../../../support/history.utils';

describe('Tyne and Wear', () => {
  test('plays its whole history, every step, drawing frames without errors', () => {
    const played = playWholeHistory(cityNetwork('tyne-and-wear'));
    expect(played.started).toBe(played.steps);
    expect(played.cursor).toBe(played.steps);
    expect(played.mostHighlighted).toBeGreaterThan(5);
  });

  test.each(['washington', 'extension-corridors'])('plays on through its %s plan, section by section', plan => {
    const played = playPlan(cityNetwork('tyne-and-wear'), plan);
    expect(played.steps).toBeGreaterThan(0);
    expect(played.started).toBe(played.steps);
    expect(played.cursor).toBe(played.steps);
  });
});
