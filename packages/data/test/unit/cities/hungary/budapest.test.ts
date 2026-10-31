import { describe, expect, test } from 'vitest';
import { cityNetwork, lineSplits, playPlan, playWholeHistory } from '../../../support/history.utils';

describe('Budapest', () => {
  test('keeps each line in one piece, but where its history parts it', () => {
    expect(lineSplits(cityNetwork('budapest'))).toEqual([
      // M3's renovation closed its middle from November 2020, its ends running on their own.
      'm3 2020-11-07: 2 pieces',
    ]);
  });

  test('plays its whole history, every step, drawing frames without errors', () => {
    const played = playWholeHistory(cityNetwork('budapest'));
    expect(played.started).toBe(played.steps);
    expect(played.cursor).toBe(played.steps);
  });

  test.each([
    'm1-bkk-2014',
    'm2-hev-link',
    'm2-budagyongye',
    'm3-kaposztasmegyer',
    'network-1976',
    'revision-1980s',
    'm4-extensions',
    'm4-viragpiac-2009',
    'm5-first-phase',
    'm5-2005',
  ])('plays on through its %s plan, section by section', plan => {
    const played = playPlan(cityNetwork('budapest'), plan);
    expect(played.steps).toBeGreaterThan(0);
    expect(played.started).toBe(played.steps);
    expect(played.cursor).toBe(played.steps);
  });
});
