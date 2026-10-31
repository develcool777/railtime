import { describe, expect, test } from 'vitest';
import { cityNetwork, lineSplits, playWholeHistory } from '../../../support/history.utils';

describe('Donetsk', () => {
  test('keeps each line in one piece, but where its history parts it', () => {
    expect(lineSplits(cityNetwork('donetsk'))).toEqual([]);
  });

  test.each(['soviet-project'])('plays its %s plan, section by section, drawing frames without errors', plan => {
    const played = playWholeHistory(cityNetwork('donetsk'), plan);
    expect(played.steps).toBeGreaterThan(0);
    expect(played.started).toBe(played.steps);
    expect(played.cursor).toBe(played.steps);
  });
});
