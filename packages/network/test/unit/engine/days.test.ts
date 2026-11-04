import { toTimestamp } from '@railtime/core/date.utils';
import { lineId, stationId } from '@railtime/schema/testing/ids';
import { describe, expect, test } from 'vitest';
import { collectDays } from '../../../src/engine/days.utils';
import { NetworkIndex } from '../../../src/engine/index.service';
import { StationStops } from '../../../src/engine/stops.service';
import { tinyNetwork } from '../../support/factories/tinyNetwork.utils';

describe('DaysUtils', () => {
  describe('collectDays', () => {
    test("gathers a station's spell closed as a closing for a while on its first day and a reopening on its last", () => {
      const network = tinyNetwork();
      network.stations[stationId('b')] = {
        ...network.stations[stationId('b')]!,
        suspended: { [lineId('red')]: [{ from: '1915-03-15', until: '1926-07-19' }] },
      };
      const days = collectDays(new NetworkIndex(network), new StationStops());
      expect(days.get(toTimestamp('1915-03-15'))?.stationCloses).toEqual([{ station: 'b', line: 'red', temporary: true }]);
      expect(days.get(toTimestamp('1926-07-19'))?.infills).toEqual([{ station: 'b', line: 'red', reopening: true }]);
    });

    test('gathers a closing for good, an opening on a line already there, and a rename on their days', () => {
      const days = collectDays(new NetworkIndex(tinyNetwork()), new StationStops());
      expect(days.get(toTimestamp('1960-01-01'))?.stationCloses).toEqual([{ station: 'd', line: 'red', temporary: false }]);
      expect(days.get(toTimestamp('1920-06-01'))?.infills).toEqual([{ station: 'c', line: 'red', reopening: false }]);
      expect(days.get(toTimestamp('1925-01-01'))?.renames).toEqual([{ station: 'd', from: 'Old D', to: 'D' }]);
    });

    test('gathers a closing on 1 January 1970, whose timestamp is 0, as any other', () => {
      const network = tinyNetwork();
      // Within bounds: the tiny network's B–C segment, where blue runs.
      network.segments[1]!.lines[lineId('blue')]!.close = '1970-01-01';
      const days = collectDays(new NetworkIndex(network), new StationStops());
      expect(days.get(toTimestamp('1970-01-01'))?.closes.map(lineSegment => lineSegment.line)).toContain('blue');
    });

    test('marks a line that passes a station, or reaches it only after it opened there, as never calling', () => {
      const network = tinyNetwork();
      network.stations[stationId('a')] = { ...network.stations[stationId('a')]!, passes: [lineId('pink')] };
      const stops = new StationStops();
      collectDays(new NetworkIndex(network), stops);
      // Pink passes A; blue left C before C opened on it; red calls at C from its opening there.
      expect([stops.ever(stationId('a'), lineId('pink')), stops.ever(stationId('c'), lineId('blue')), stops.ever(stationId('c'), lineId('red'))]).toEqual([
        false,
        false,
        true,
      ]);
    });
  });
});
