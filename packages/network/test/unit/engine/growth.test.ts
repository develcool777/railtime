import { lineId, stationId } from '@railtime/schema/testing/ids';
import { describe, expect, test } from 'vitest';
import { NetworkIndex } from '../../../src/engine/index.service';
import { Timeline } from '../../../src/engine/timeline.service';
import { planGrowth } from '../../../src/engine/timeline.utils';
import { tinyNetwork } from '../../support/factories/tinyNetwork.utils';

const timelineOf = (network = tinyNetwork()) => {
  const index = new NetworkIndex(network);
  return { index, timeline: new Timeline(index) };
};

describe('Growths', () => {
  test('grows an opening out of the stations on the map before it, worked out once, new only where it opens a station', () => {
    const { index, timeline } = timelineOf();
    const extension = timeline.steps.find(step => step.kind === 'open' && step.segments.some(segment => segment.stationB === 'c' || segment.stationA === 'c'));
    if (extension?.kind !== 'open') throw new Error('the tiny network extends red to C');
    const growth = timeline.growths.growthOf(extension);
    const planned = planGrowth(extension.segments, timeline.stationsOnMap(extension.index), station => index.coordOf(station), index.centre);
    expect(growth.plans).toEqual(planned.plans);
    // B was on the map; red runs through C from 1910 but calls there only from 1920: D alone is new.
    expect(growth.reach.map(reached => [reached.station, reached.isNew])).toEqual([
      ['b', false],
      ['c', false],
      ['d', true],
    ]);
    expect(planned.reach.find(reached => reached.station === 'c')?.isNew).toBe(true);
    expect(timeline.growths.growthOf(extension)).toBe(growth);
  });

  test('retracts a closure back to the stations still on the map after it, worked out once, new where a station leaves', () => {
    const network = tinyNetwork();
    network.stations[stationId('e')] = { name: 'E', coordinate: [4 * 0.0144, 51.5] };
    network.segments.push({
      stationA: stationId('d'),
      stationB: stationId('e'),
      lines: { [lineId('blue')]: { open: '1930-01-01', close: '1950-01-01' } },
      coordinates: [
        [3 * 0.0144, 51.5],
        [4 * 0.0144, 51.5],
      ],
    });
    const { timeline } = timelineOf(network);
    const closure = timeline.steps.find(step => step.kind === 'close' && step.lineSegments.some(({ segment }) => segment.stationB === 'e'));
    if (closure?.kind !== 'close') throw new Error('blue closes D–E in 1950');
    const retreat = timeline.growths.retreatOf(closure);
    // Played backwards, its front runs from E back to D, which stays on red.
    const toE = retreat.plans.find(plan => plan.segment.stationB === 'e');
    expect(toE?.fromStationA).toBe(true);
    expect(retreat.reach.filter(reached => reached.isNew).map(reached => reached.station)).toEqual(['e']);
    expect(timeline.growths.retreatOf(closure)).toBe(retreat);
  });
});
