import { describe, expect, test } from 'vitest';
import { lineBranches, lineLengthKm, stepChangesLine } from '../../../src/model/lineDetails.utils';
import { NetworkIndex } from '../../../src/model/networkIndex.service';
import { Timeline } from '../../../src/model/timeline.service';
import { tinyNetwork } from '../../support/factories/tinyNetwork.utils';

const index = new NetworkIndex(tinyNetwork());
const timeline = new Timeline(index);
/** The cursor on a day: every step on or before it has happened. */
const on = (year: number) => timeline.cursorAt(Date.UTC(year, 6, 1));

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

    test('lists a branch from the station it leaves', () => {
      const network = tinyNetwork();
      network.stations.x = { name: 'X', coordinate: [0.0144, 51.504] };
      network.segments.push({
        stationA: 'b',
        stationB: 'x',
        coordinates: [
          [0.0144, 51.5],
          [0.0144, 51.504],
        ],
        lines: { red: { open: '1900-01-01' } },
      });
      const branched = new NetworkIndex(network);
      const branchedTimeline = new Timeline(branched);
      const runs = lineBranches(branched, branchedTimeline, 'red', branchedTimeline.cursorAt(Date.UTC(1930, 0, 1)));
      expect(runs[0]).toHaveLength(4);
      expect(runs[1]).toEqual(['b', 'x']);
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
