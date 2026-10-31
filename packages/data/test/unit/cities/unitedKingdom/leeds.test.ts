import { describe, expect, test } from 'vitest';
import { cityNetwork, lineSplits, playWholeHistory } from '../../../support/history.utils';

describe('Leeds', () => {
  test('keeps each line in one piece, but where its history parts it', () => {
    expect(lineSplits(cityNetwork('leeds'))).toEqual([]);
  });

  test.each(['supertram'])('plays its %s plan, section by section, drawing frames without errors', plan => {
    const played = playWholeHistory(cityNetwork('leeds'), plan);
    expect(played.steps).toBeGreaterThan(0);
    expect(played.started).toBe(played.steps);
    expect(played.cursor).toBe(played.steps);
  });
});
