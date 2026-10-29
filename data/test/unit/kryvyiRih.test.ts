import { describe, expect, test } from 'vitest';
import { cityNetwork, playWholeHistory } from '../support/history.utils';

describe('Kryvyi Rih', () => {
  test('plays its whole history, every step, drawing frames without errors', () => {
    const played = playWholeHistory(cityNetwork('kryvyi-rih'));
    expect(played.started).toBe(played.steps);
    expect(played.cursor).toBe(played.steps);
  });

  test.each(['vovnopriadylna', 'rokuvata-2021', 'project-1972'])('plays on through its %s plan, section by section', plan => {
    const played = playWholeHistory(cityNetwork('kryvyi-rih'), plan);
    expect(played.started).toBe(played.steps);
    expect(played.cursor).toBe(played.steps);
    expect(played.steps).toBeGreaterThan(playWholeHistory(cityNetwork('kryvyi-rih')).steps);
  });
});
