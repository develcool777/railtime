import { describe, expect, test } from 'vitest';
import { cityNetwork, lineSplits, playPlan, playWholeHistory } from '../../../support/history.utils';

describe('Dnipro', () => {
  test('keeps each line in one piece, but where its history parts it', () => {
    expect(lineSplits(cityNetwork('dnipro'))).toEqual([]);
  });

  test('plays its whole history, every step, drawing frames without errors', () => {
    const played = playWholeHistory(cityNetwork('dnipro'));
    expect(played.started).toBe(played.steps);
    expect(played.cursor).toBe(played.steps);
    expect(played.mostHighlighted).toBeGreaterThan(5);
  });

  test.each(['under-construction', 'long-term'])('plays on through its %s plan, section by section', plan => {
    const played = playPlan(cityNetwork('dnipro'), plan);
    expect(played.steps).toBeGreaterThan(0);
    expect(played.started).toBe(played.steps);
    expect(played.cursor).toBe(played.steps);
  });
});
