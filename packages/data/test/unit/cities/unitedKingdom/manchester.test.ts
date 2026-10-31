import { describe, expect, test } from 'vitest';
import { cityNetwork, lineSplits, playPlan, playWholeHistory } from '../../../support/history.utils';

describe('Manchester', () => {
  test('keeps each line in one piece, but where its history parts it', () => {
    expect(lineSplits(cityNetwork('manchester'))).toEqual([
      // The temporary route through Oldham Mumps closed nine days before the town-centre route opened.
      'oldham-rochdale 2014-01-18: 2 pieces',
    ]);
  });

  test('plays its whole history, every step, drawing frames without errors', () => {
    const played = playWholeHistory(cityNetwork('manchester'));
    expect(played.started).toBe(played.steps);
    expect(played.cursor).toBe(played.steps);
    expect(played.mostHighlighted).toBeGreaterThan(5);
  });

  test.each(['picc-vic', 'bee-network-2040'])('plays on through its %s plan, section by section', plan => {
    const played = playPlan(cityNetwork('manchester'), plan);
    expect(played.steps).toBeGreaterThan(0);
    expect(played.started).toBe(played.steps);
    expect(played.cursor).toBe(played.steps);
  });
});
