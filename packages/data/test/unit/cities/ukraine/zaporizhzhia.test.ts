import { describe, expect, test } from 'vitest';
import { cityNetwork, lineSplits, playWholeHistory } from '../../../support/history.utils';

describe('Zaporizhzhia', () => {
  test('keeps each line in one piece, but where its history parts it', () => {
    expect(lineSplits(cityNetwork('zaporizhzhia'))).toEqual([]);
  });

  test.each(['light-metro-project'])('plays its %s plan, section by section, drawing frames without errors', plan => {
    const played = playWholeHistory(cityNetwork('zaporizhzhia'), plan);
    expect(played.steps).toBeGreaterThan(0);
    expect(played.started).toBe(played.steps);
    expect(played.cursor).toBe(played.steps);
  });
});
