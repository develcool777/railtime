import { describe, expect, test } from 'vitest';
import { lineBranches, lineLengthKm, stepChangesLine } from '../../../src/network/lineDetails.utils';
import { NetworkIndex } from '../../../src/network/index.service';
import { Timeline } from '../../../src/network/timeline.service';
import { tinyNetwork } from '../../support/factories/tinyNetwork.utils';
import type { Network } from '@railtime/schema/network.types';

const index = new NetworkIndex(tinyNetwork());
const timeline = new Timeline(index);
/** The cursor on a day: every step on or before it has happened. */
const on = (year: number) => timeline.cursorAt(Date.UTC(year, 6, 1));

/**
 * Adds a station X north of a point on the test line, and red track to it from a station.
 *
 * @param network - The network, changed in place.
 * @param from - The station the track leaves.
 * @param to - The new station's id.
 * @param position - Km east of A where X stands.
 * @param open - When red opens to it.
 */
const addRed = (network: Network, from: string, to: string, position: number, open: string): void => {
  const coordinate: [number, number] = [position * 0.0144, 51.504];
  network.stations[to] = { name: to.toUpperCase(), coordinate };
  network.segments.push({ stationA: from, stationB: to, coordinates: [network.stations[from]!.coordinate, coordinate], lines: { red: { open } } });
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
  return lineBranches(changed, changedTimeline, 'red', changedTimeline.cursorAt(Date.UTC(year, 6, 1)));
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
      expect(redBranches(network => addRed(network, 'b', 'x', 1, '1900-01-01'), 1930)).toEqual([
        ['a', 'b', 'c', 'd'],
        ['b', 'x'],
      ]);
      // In 1915 C is on red's track but not a stop: the branch still leaves from it.
      expect(redBranches(network => addRed(network, 'c', 'x', 2, '1910-01-01'), 1915)).toEqual([
        ['a', 'b', 'd'],
        ['c', 'x'],
      ]);
    });

    test('shows no branch for a second track between two stations listed, and a piece apart as a run of its own', () => {
      const secondTrack = (network: Network) =>
        network.segments.push({
          stationA: 'b',
          stationB: 'c',
          coordinates: [
            [0.0144, 51.5],
            [0.0216, 51.501],
            [0.0288, 51.5],
          ],
          lines: { red: { open: '1910-01-01' } },
        });
      expect(redBranches(secondTrack, 1930)).toEqual([['a', 'b', 'c', 'd']]);
      const apart = (network: Network) => {
        network.stations.y = { name: 'Y', coordinate: [0, 51.51] };
        addRed(network, 'y', 'x', 0, '1900-01-01');
      };
      expect(redBranches(apart, 1930)).toEqual([
        ['a', 'b', 'c', 'd'],
        ['y', 'x'],
      ]);
    });

    test('lists a loop once, round to where it began', () => {
      const network = tinyNetwork();
      network.segments.push({
        stationA: 'd',
        stationB: 'a',
        coordinates: [
          [0.0432, 51.5],
          [0, 51.5],
        ],
        lines: { red: { open: '1900-01-01' } },
      });
      const looped = new NetworkIndex(network);
      const loopedTimeline = new Timeline(looped);
      const runs = lineBranches(looped, loopedTimeline, 'red', loopedTimeline.cursorAt(Date.UTC(1930, 0, 1)));
      expect(runs).toHaveLength(1);
      expect(runs[0]).toHaveLength(5);
      expect(runs[0]![0]).toBe(runs[0]![4]);
    });
  });

  describe('lineLengthKm', () => {
    test('adds up the track open on the day', () => {
      expect(lineLengthKm(index, timeline, 'red', on(1905))).toBeCloseTo(1, 1);
      expect(lineLengthKm(index, timeline, 'red', on(1915))).toBeCloseTo(3, 1);
    });
  });

  describe('stepChangesLine', () => {
    test("finds the line's openings, closures, stations and identity, not others'", () => {
      const kinds = timeline.steps.filter(step => stepChangesLine(step, 'blue')).map(step => step.kind);
      expect(kinds).toEqual(['open', 'close', 'open', 'close']);
      expect(timeline.steps.filter(step => stepChangesLine(step, 'pink')).map(step => step.kind)).toEqual(['open', 'identity']);
    });
  });
});
