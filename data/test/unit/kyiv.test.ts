import { describe, expect, test } from 'vitest';
import { cityNetwork, playWholeHistory } from '../support/history.utils';

describe('Kyiv', () => {
  test('plays its whole history, every step, drawing frames without errors', () => {
    const played = playWholeHistory(cityNetwork('kyiv'));
    expect(played.started).toBe(played.steps);
    expect(played.cursor).toBe(played.steps);
    // The first line's five stations of 1960: no later opening added more at once.
    expect(played.mostHighlighted).toBe(5);
  });

  test.each(['under-construction', 'long-term'])('plays on through its %s plan, section by section', plan => {
    const played = playWholeHistory(cityNetwork('kyiv'), plan);
    expect(played.started).toBe(played.steps);
    expect(played.cursor).toBe(played.steps);
    expect(played.steps).toBeGreaterThan(playWholeHistory(cityNetwork('kyiv')).steps);
  });
});
