import { describe, expect, test } from 'vitest';
import { cityNetwork, playWholeHistory } from '../support/history.utils';

describe('Dnipro', () => {
  test('plays its whole history, every step, drawing frames without errors', () => {
    const played = playWholeHistory(cityNetwork('dnipro'));
    expect(played.started).toBe(played.steps);
    expect(played.cursor).toBe(played.steps);
    expect(played.mostHighlighted).toBeGreaterThan(5);
  });
});
