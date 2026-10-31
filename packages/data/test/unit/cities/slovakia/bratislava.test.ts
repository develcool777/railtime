import { describe, expect, test } from 'vitest';
import { cityNetwork, lineSplits, playWholeHistory } from '../../../support/history.utils';

describe('Bratislava', () => {
  test('keeps each line in one piece, but where its history parts it', () => {
    expect(lineSplits(cityNetwork('bratislava'))).toEqual([]);
  });

  test.each(['temporary-line-1983', 'metro-1988', 'light-metro-1990s'])('plays its %s plan, section by section, drawing frames without errors', plan => {
    const played = playWholeHistory(cityNetwork('bratislava'), plan);
    expect(played.steps).toBeGreaterThan(0);
    expect(played.started).toBe(played.steps);
    expect(played.cursor).toBe(played.steps);
  });
});
