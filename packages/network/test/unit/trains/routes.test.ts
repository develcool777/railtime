import { byCodeUnits } from '@railtime/core/text.utils';
import { lineId, stationId } from '@railtime/schema/testing/ids';
import { describe, expect, test } from 'vitest';
import { NetworkIndex } from '../../../src/engine/index.service';
import { Timeline } from '../../../src/engine/timeline.service';
import { trainRunsAt } from '../../../src/trains/routes.utils';
import { tinyNetwork } from '../../support/factories/tinyNetwork.utils';

/**
 * Where trains run in a year, on the test network.
 *
 * @param year - The year.
 * @param network - The network.
 * @returns The runs.
 */
const runsIn = (year: number, network = tinyNetwork()) => {
  const index = new NetworkIndex(network);
  const timeline = new Timeline(index);
  return trainRunsAt(index, timeline, timeline.cursorAt(Date.UTC(year, 0, 1)));
};

describe('RouteUtils', () => {
  describe('trainRunsAt', () => {
    test('lays each line out end to end: its track in order, how long it is, and its stops', () => {
      const run = runsIn(1930).find(each => each.line === lineId('red'));
      expect(run?.lengthKm).toBeCloseTo(3, 1);
      expect(run?.legs.map(leg => leg.startKm.toFixed(1))).toEqual(['0.0', '1.0', '2.0']);
      expect(run?.stopsKm.map(km => km.toFixed(1))).toEqual(['0.0', '1.0', '2.0', '3.0']);
    });

    test('says which way each stretch of track is run, each picking up where the last left off', () => {
      const run = runsIn(1930).find(each => each.line === lineId('red'));
      const ends = run?.legs.map(({ segment, forward }) => (forward ? [segment.stationA, segment.stationB] : [segment.stationB, segment.stationA])) ?? [];
      expect(ends.slice(1).map(([from]) => from)).toEqual(ends.slice(0, -1).map(([, to]) => to));
    });

    test('runs only on track open then', () => {
      expect(runsIn(1905).find(each => each.line === lineId('red'))?.lengthKm).toBeCloseTo(1, 1);
      expect(runsIn(1905).filter(each => each.line === lineId('green'))).toEqual([]);
    });

    test('stops nowhere a line runs through without calling', () => {
      const run = runsIn(1975).find(each => each.line === lineId('green'));
      expect(run?.lengthKm).toBeCloseTo(1, 1);
      expect(run?.stopsKm).toHaveLength(1);
    });

    test('runs a fork end to end: the branch goes on past it to the far end, sharing the track', () => {
      const network = tinyNetwork();
      network.stations[stationId('e')] = { name: 'E', coordinate: [0.0144, 51.51] };
      network.segments.push({
        stationA: stationId('b'),
        stationB: stationId('e'),
        coordinates: [
          [0.0144, 51.5],
          [0.0144, 51.51],
        ],
        lines: { [lineId('red')]: { open: '1900-01-01' } },
      });
      const routes = runsIn(1930, network).filter(run => run.line === lineId('red'));
      expect(routes.map(run => run.ends.toSorted(byCodeUnits).join('–')).toSorted(byCodeUnits)).toEqual(['a–d', 'd–e']);
      expect(routes.map(run => run.legs.map(({ segment }) => segment.lengthKm.toFixed(0)))).toEqual([
        ['1', '1', '1'],
        ['1', '1', '1'],
      ]);
    });

    test('turns the first route to start where its branch does, so neither waits on shared track', () => {
      const network = tinyNetwork();
      network.stations[stationId('e')] = { name: 'E', coordinate: [0.0144, 51.51] };
      network.segments.push({
        stationA: stationId('b'),
        stationB: stationId('e'),
        coordinates: [
          [0.0144, 51.5],
          [0.0144, 51.51],
        ],
        lines: { [lineId('red')]: { open: '1900-01-01' } },
      });
      const [first, branch] = runsIn(1930, network).filter(run => run.line === lineId('red'));
      expect(first?.ends[0]).toBe(branch?.ends[0]);
    });

    test('takes each stretch the right way along a branch laid out backwards to the fork', () => {
      const network = tinyNetwork();
      network.stations[stationId('e')] = { name: 'E', coordinate: [0.0144, 51.51] };
      network.segments.push({
        stationA: stationId('e'),
        stationB: stationId('b'),
        coordinates: [
          [0.0144, 51.51],
          [0.0144, 51.5],
        ],
        lines: { [lineId('red')]: { open: '1900-01-01' } },
      });
      const route = runsIn(1930, network).filter(run => run.line === lineId('red'))[1];
      const ends = route?.legs.map(({ segment, forward }) => (forward ? [segment.stationA, segment.stationB] : [segment.stationB, segment.stationA])) ?? [];
      expect(ends.slice(1).map(([from]) => from)).toEqual(ends.slice(0, -1).map(([, to]) => to));
    });

    test('runs a loop between one station and itself, where it closes', () => {
      const network = tinyNetwork();
      network.segments.push({
        stationA: stationId('d'),
        stationB: stationId('a'),
        coordinates: [
          [0.0432, 51.5],
          [0, 51.5],
        ],
        lines: { [lineId('red')]: { open: '1900-01-01' } },
      });
      const run = runsIn(1930, network).find(each => each.line === lineId('red'));
      expect(run?.ends[0]).toBe(run?.ends[1]);
    });
  });
});
