import { describe, expect, test } from 'vitest';
import { cityNetwork, playPlan, playWholeHistory } from '../../../support/history.utils';

describe('Lisbon', () => {
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
