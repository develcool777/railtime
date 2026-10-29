import { describe, expect, test } from 'vitest';
import { cityNetwork, playWholeHistory } from '../support/history.utils';

describe('Kharkiv', () => {
  test('plays its whole history, every step, drawing frames without errors', () => {
    const played = playWholeHistory(cityNetwork('kharkiv'));
    expect(played.started).toBe(played.steps);
    expect(played.cursor).toBe(played.steps);
    expect(played.mostHighlighted).toBeGreaterThan(5);
  });

  test.each(['under-construction', 'long-term'])('plays on through its %s plan, section by section', plan => {
    const played = playWholeHistory(cityNetwork('kharkiv'), plan);
    expect(played.started).toBe(played.steps);
    expect(played.cursor).toBe(played.steps);
    expect(played.steps).toBeGreaterThan(playWholeHistory(cityNetwork('kharkiv')).steps);
  });
});
