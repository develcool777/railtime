import { byCodeUnits } from '@railtime/core/text.utils';
import type { Network, StationId } from '@railtime/schema/network.types';
import { lineId, stationId } from '@railtime/schema/testing/ids';
import { describe, expect, test } from 'vitest';
import { NetworkIndex } from '../../../src/engine/index.service';
import { lineHops, lineLengthKm, lineRuns, stepChangesLine, directionsAt } from '../../../src/engine/lineDetails.utils';
import { Timeline } from '../../../src/engine/timeline.service';
import { loopNetwork } from '../../support/factories/loopNetwork.utils';
import { tinyNetwork } from '../../support/factories/tinyNetwork.utils';

const index = new NetworkIndex(tinyNetwork());
const timeline = new Timeline(index);
/** The cursor on a day: every step on or before it has happened. */
const on = (year: number) => timeline.cursorAt(Date.UTC(year, 6, 1));

/** A line's stops in the order it runs, by run of track. */
const lineBranches = (network: NetworkIndex, history: Timeline, line: string, cursor: number) =>
  lineRuns(network, history, [lineId(line)], cursor).map(run => run.stops);

/**
 * Adds a station X north of a point on the test line, and red track to it from a station.
 *
 * @param network - The network, changed in place.
 * @param from - The station the track leaves.
 * @param position - Km east of A where X stands.
 * @param open - When red opens to it.
 */
const addRed = (network: Network, from: StationId, position: number, open: string): void => {
  const coordinate: [number, number] = [position * 0.0144, 51.504];
  network.stations[stationId('x')] = { name: 'X', coordinate };
  network.segments.push({
    stationA: from,
    stationB: stationId('x'),
    coordinates: [network.stations[from]!.coordinate, coordinate],
    lines: { [lineId('red')]: { open } },
  });
};

/**
 * Red's runs, on a changed tiny network, in the middle of a year.
 *
 * @param change - What to change.
 * @param year - The year.
 * @returns The runs.
 */
const redBranches = (change: (network: Network) => void, year: number): string[][] => {
  const network = tinyNetwork();
  change(network);
  const changed = new NetworkIndex(network);
  const changedTimeline = new Timeline(changed);
  return lineBranches(changed, changedTimeline, lineId('red'), changedTimeline.cursorAt(Date.UTC(year, 6, 1)));
};

describe('LineDetailsUtils', () => {
  describe('lineBranches', () => {
    test('lists a line end to end, its stops only', () => {
      // C is on red's track from 1910 but a stop only from 1920.
      expect(lineBranches(index, timeline, 'red', on(1915))).toEqual([['a', 'b', 'd']]);
      expect(lineBranches(index, timeline, 'red', on(1925))).toEqual([['a', 'b', 'c', 'd']]);
    });

    test('has nothing for a line not open', () => {
      expect(lineBranches(index, timeline, 'green', on(1950))).toEqual([]);
      expect(lineBranches(index, timeline, 'blue', on(1942))).toEqual([]);
    });

    test('lists the line end to end, then a branch from the station it leaves, kept though not yet a stop', () => {
      expect(redBranches(network => addRed(network, stationId('b'), 1, '1900-01-01'), 1930)).toEqual([
        ['a', 'b', 'c', 'd'],
        ['b', 'x'],
      ]);
      // In 1915 C is on red's track but not a stop: the branch still leaves from it.
      expect(redBranches(network => addRed(network, stationId('c'), 2, '1910-01-01'), 1915)).toEqual([
        ['a', 'b', 'd'],
        ['c', 'x'],
      ]);
    });

    test('shows no branch for a second track between two stations listed, and a piece apart as a run of its own', () => {
      const secondTrack = (network: Network) => {
        network.segments.push({
          stationA: stationId('b'),
          stationB: stationId('c'),
          coordinates: [
            [0.0144, 51.5],
            [0.0216, 51.501],
            [0.0288, 51.5],
          ],
          lines: { [lineId('red')]: { open: '1910-01-01' } },
        });
      };
      expect(redBranches(secondTrack, 1930)).toEqual([['a', 'b', 'c', 'd']]);
      const apart = (network: Network) => {
        network.stations[stationId('y')] = { name: 'Y', coordinate: [0, 51.51] };
        addRed(network, stationId('y'), 0, '1900-01-01');
      };
      expect(redBranches(apart, 1930)).toEqual([
        ['a', 'b', 'c', 'd'],
        ['y', 'x'],
      ]);
    });

    test('lists a loop once, round to where it began', () => {
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
      const looped = new NetworkIndex(network);
      const loopedTimeline = new Timeline(looped);
      const runs = lineBranches(looped, loopedTimeline, 'red', loopedTimeline.cursorAt(Date.UTC(1930, 0, 1)));
      expect(runs).toHaveLength(1);
      expect(runs[0]).toHaveLength(5);
      expect(runs[0]![0]).toBe(runs[0]![4]);
    });
  });

  describe('lineRuns', () => {
    const loop = new NetworkIndex(loopNetwork());
    const history = new Timeline(loop);
    const today = history.steps.length;

    test('runs a loop whose line says a way round that way, whichever way its track is listed', () => {
      const [clockwise] = lineRuns(loop, history, [lineId('clockwise')], today);
      const [anticlockwise] = lineRuns(loop, history, [lineId('anticlockwise')], today);
      expect(clockwise?.oneWay).toBe(true);
      expect(anticlockwise?.oneWay).toBe(true);
      expect(clockwise?.stations).toEqual(anticlockwise?.stations.toReversed());
      // A north of B, C east of them: round by A, C, B is clockwise on the map.
      expect(clockwise?.stations.slice(0, 3)).toEqual(['a', 'c', 'b']);
    });

    test('keeps a loop with no way round both ways, and lines drawn as one to their stops', () => {
      expect(lineRuns(loop, history, [lineId('both')], today)[0]?.oneWay).toBe(false);
      // Red and pink share A – B: drawn as one in 1915 they run A to D, no second run for pink.
      expect(lineRuns(index, timeline, [lineId('red'), lineId('pink')], on(1915)).map(run => run.stops)).toEqual([['a', 'b', 'd']]);
    });

    test('calls at a stop any of the lines drawn as one calls at, and no other', () => {
      // Blue is drawn alone here; pink's stops are A and B, red does not call at C until 1920.
      expect(lineRuns(index, timeline, [lineId('pink'), lineId('blue')], on(1935)).map(run => run.stops)).toEqual([['a', 'b']]);
    });
  });

  describe('lineHops', () => {
    const loop = new NetworkIndex(loopNetwork());
    const history = new Timeline(loop);
    const today = history.steps.length;

    test('rides both ways along a line, stop to stop', () => {
      const hops = lineHops(index, timeline, lineId('red'), on(1935));
      expect(hops.get(stationId('b'))?.map(hop => hop.to)).toEqual(['a', 'c']);
    });

    test('rides straight past a station the line does not call at', () => {
      const hops = lineHops(index, timeline, lineId('red'), on(1915));
      expect(hops.has(stationId('c'))).toBe(false);
      expect(hops.get(stationId('b'))?.map(({ to, segments }) => [to, segments])).toEqual([
        ['a', [0]],
        ['d', [1, 2]],
      ]);
      expect(hops.get(stationId('b'))?.[1]?.km).toBeCloseTo(2, 1);
    });

    test('goes only the way a one-way loop goes, and both ways round a loop that says none', () => {
      expect(
        lineHops(loop, history, lineId('clockwise'), today)
          .get(stationId('a'))
          ?.map(hop => hop.to),
      ).toEqual(['c']);
      expect(
        lineHops(loop, history, lineId('anticlockwise'), today)
          .get(stationId('a'))
          ?.map(hop => hop.to),
      ).toEqual(['b']);
      expect(
        lineHops(loop, history, lineId('both'), today)
          .get(stationId('a'))
          ?.map(hop => hop.to)
          .toSorted(byCodeUnits),
      ).toEqual(['b', 'c']);
    });
  });

  describe('lineLengthKm', () => {
    test('adds up the track open on the day', () => {
      expect(lineLengthKm(index, timeline, [lineId('red')], on(1905))).toBeCloseTo(1, 1);
      expect(lineLengthKm(index, timeline, [lineId('red')], on(1915))).toBeCloseTo(3, 1);
    });

    test('counts track lines drawn as one share once', () => {
      expect(lineLengthKm(index, timeline, [lineId('red'), lineId('pink')], on(1915))).toBeCloseTo(3, 1);
    });
  });

  describe('stepChangesLine', () => {
    test("finds the line's openings, closures, stations and identity, not others'", () => {
      const kinds = timeline.steps.filter(step => stepChangesLine(step, lineId('blue'))).map(step => step.kind);
      expect(kinds).toEqual(['open', 'close', 'open', 'close']);
      expect(timeline.steps.filter(step => stepChangesLine(step, lineId('pink'))).map(step => step.kind)).toEqual(['open', 'identity']);
    });
  });
  describe('directionsAt', () => {
    /**
     * A line on the date shown, as its runs of stops; a stop's name is its id in capitals.
     *
     * @param branches - Its runs, each a list of station ids.
     * @param oneWay - Whether they run one way.
     * @returns The runs.
     */
    const line = (branches: StationId[][], oneWay = false) =>
      branches.map(run => ({ stops: run.map(stop => ({ id: stop, name: stop.toUpperCase() })), oneWay }));

    test('gives the stop either side, each with the end of the line that way', () => {
      expect(directionsAt(stationId('c'), line([[stationId('a'), stationId('b'), stationId('c'), stationId('d'), stationId('e')]]))).toEqual([
        { previous: { id: 'b', name: 'B', towards: 'A' }, next: { id: 'd', name: 'D', towards: 'E' } },
      ]);
    });

    test('says no "towards" for a stop that is the end', () => {
      expect(directionsAt(stationId('b'), line([[stationId('a'), stationId('b'), stationId('c')]]))).toEqual([
        { previous: { id: 'a', name: 'A', towards: null }, next: { id: 'c', name: 'C', towards: null } },
      ]);
    });

    test('at an end, goes one way', () => {
      expect(directionsAt(stationId('a'), line([[stationId('a'), stationId('b'), stationId('c')]]))).toEqual([
        { previous: null, next: { id: 'b', name: 'B', towards: 'C' } },
      ]);
    });

    test('at a junction, gives a pair for the branch too', () => {
      const found = directionsAt(
        stationId('b'),
        line([
          [stationId('a'), stationId('b'), stationId('c')],
          [stationId('b'), stationId('x'), stationId('y')],
        ]),
      );
      expect(found).toEqual([
        { previous: { id: 'a', name: 'A', towards: null }, next: { id: 'c', name: 'C', towards: null } },
        { previous: null, next: { id: 'x', name: 'X', towards: 'Y' } },
      ]);
    });

    test('on a run one way, gives only the stop its trains go on to', () => {
      expect(directionsAt(stationId('b'), line([[stationId('a'), stationId('b'), stationId('c'), stationId('a')]], true))).toEqual([
        { previous: null, next: { id: 'c', name: 'C', towards: 'A' } },
      ]);
    });

    test('gives nothing where the line does not call', () => {
      expect(directionsAt(stationId('z'), line([[stationId('a'), stationId('b')]]))).toEqual([]);
    });
  });
});
