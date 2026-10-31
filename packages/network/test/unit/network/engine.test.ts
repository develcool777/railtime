import { toTimestamp } from '@railtime/core/date.utils';
import { describe, expect, test } from 'vitest';
import { NetworkEngine } from '../../../src/network/engine.service';
import { tinyNetwork } from '../../support/factories/tinyNetwork.utils';

/** Today, for every engine here. */
const TODAY = toTimestamp('2026-01-01');

describe('NetworkEngine', () => {
  test('indexes the network and plays its history, from its first date to today', () => {
    const engine = new NetworkEngine(tinyNetwork(), null, TODAY);
    expect(engine.range).toEqual({ start: toTimestamp('1899-01-01'), end: TODAY, today: TODAY });
    expect(engine.timeline.steps.every(step => !step.planned)).toBe(true);
    expect(engine.index.coordOf('a')).toEqual([0, 51.5]);
  });

  test('builds a plan on the network: its stations indexed, its sections played last', () => {
    const engine = new NetworkEngine(tinyNetwork(), 'extension', TODAY);
    expect(engine.timeline.steps.at(-1)?.planned).toBe(true);
    expect(() => engine.index.coordOf('e')).not.toThrow();
    expect(() => new NetworkEngine(tinyNetwork(), null, TODAY).index.coordOf('e')).toThrow();
  });
});
