import { describe, expect, test } from 'vitest';
import { cityNetwork, playPlan, playWholeHistory } from '../support/history.utils';

describe('Kharkiv', () => {
  test('plays its whole history, every step, drawing frames without errors', () => {
    const played = playWholeHistory(cityNetwork('kharkiv'));
    expect(played.started).toBe(played.steps);
    expect(played.cursor).toBe(played.steps);
    expect(played.mostHighlighted).toBeGreaterThan(5);
  });

  test.each(['under-construction', 'long-term', 'concept-2025'])('plays on through its %s plan, section by section', plan => {
    const played = playPlan(cityNetwork('kharkiv'), plan);
    expect(played.steps).toBeGreaterThan(0);
    expect(played.started).toBe(played.steps);
    expect(played.cursor).toBe(played.steps);
  });
});
