import { describe, expect, test } from 'vitest';
import { cityNetwork, lineSplits, playPlan, playWholeHistory } from '../../../support/history.utils';

describe('Lisbon', () => {
  test('keeps each line in one piece, but where its history parts it', () => {
    expect(lineSplits(cityNetwork('lisbon'))).toEqual([
      // Closed in the middle for works: Azul for four days in 2020, Amarela at Campo Grande in 2023 and 2024.
      'azul 2020-09-29: 2 pieces',
      'amarela 2023-05-02: 2 pieces',
      'amarela 2024-08-03: 2 pieces',
    ]);
  });

  test('plays its whole history, every step, drawing frames without errors', () => {
    const played = playWholeHistory(cityNetwork('lisbon'));
    expect(played.started).toBe(played.steps);
    expect(played.cursor).toBe(played.steps);
  });

  test.each(['linha-circular', 'vermelha-alcantara', 'linha-violeta', 'amarela-benfica', 'loures-sacavem-2009', 'plano-2010-2020', 'linha-das-colinas'])(
    'plays on through its %s plan, section by section',
    plan => {
      const played = playPlan(cityNetwork('lisbon'), plan);
      expect(played.steps).toBeGreaterThan(0);
      expect(played.started).toBe(played.steps);
      expect(played.cursor).toBe(played.steps);
    },
  );
});
