import { describe, expect, test } from 'vitest';
import { toTimestamp } from '../../../src/core/date.utils';
import { NetworkIndex } from '../../../src/network/index.service';
import { buildPlan } from '@railtime/schema/plan.utils';
import { tinyNetwork } from '../../support/factories/tinyNetwork.utils';

describe('NetworkIndex', () => {
  test('names a station by its former name until the day it changed', () => {
    const index = new NetworkIndex(tinyNetwork());
    expect(index.stationName('d', toTimestamp('1924-12-31'))).toBe('Old D');
    expect(index.stationName('d', toTimestamp('1925-01-01'))).toBe('D');
    expect(index.stationName('d')).toBe('D');
  });

  test('makes each period of a suspended line its own line segment, linked to the next', () => {
    const index = new NetworkIndex(tinyNetwork());
    const [before, after, ...rest] = index.lineSegments.filter(lineSegment => lineSegment.line === 'blue');
    expect(rest).toEqual([]);
    expect(before).toMatchObject({ opens: toTimestamp('1930-01-01'), closes: toTimestamp('1940-01-01'), previous: null, next: after });
    expect(after).toMatchObject({ opens: toTimestamp('1945-01-01'), closes: toTimestamp('1950-01-01'), previous: before, next: null });
  });

  test("knows each station's transfers, both ways", () => {
    const index = new NetworkIndex(tinyNetwork());
    expect(index.transfersAt('a')).toEqual(['d']);
    expect(index.transfersAt('d')).toEqual(['a']);
    expect(index.transfersAt('b')).toEqual([]);
  });

  test('labels a station with its name, then its names in other languages, as of a date', () => {
    const index = new NetworkIndex(tinyNetwork());
    expect(index.stationLabel('d')).toBe('D\nД');
    expect(index.stationLabel('d', toTimestamp('1924-12-31'))).toBe('Old D\nСтарий Д');
    expect(index.stationLabel('c')).toBe('C');
    expect(index.stationName('d')).toBe('D');
    expect(index.lineName('red')).toBe('Red line');
  });

  test('leaves out another name that is the same as the English one', () => {
    const index = new NetworkIndex(tinyNetwork());
    expect(index.otherNames({ name: 'Arena', names: { uk: 'Арена', pl: 'Arena' } })).toEqual(['Арена']);
  });

  test('knows when each line first ran as itself, and that a line only a plan builds has not', () => {
    const network = tinyNetwork();
    network.plans = {
      ...network.plans,
      newLine: {
        name: 'New line',
        status: 'planned',
        lines: { purple: { name: 'Purple', network: 'metro', mode: 'metro', color: '#800080' } },
        sections: [{ line: 'purple', stations: ['a', 'b'] }],
      },
    };
    const plan = buildPlan(network, 'newLine');
    const index = new NetworkIndex(plan.network, plan.sections);
    expect(index.lineOpens('red')).toBe(toTimestamp('1900-01-01'));
    expect(index.lineOpens('green')).toBe(toTimestamp('1970-01-01'));
    // Drawn as red until 1990.
    expect(index.lineOpens('pink')).toBe(toTimestamp('1990-01-01'));
    expect(index.lineOpens('purple')).toBe(Infinity);
  });

  test("centres on the middle of its stations' box", () => {
    const index = new NetworkIndex(tinyNetwork());
    // A to D: 0 to 3 km east, on one latitude.
    expect(index.centre[0]).toBeCloseTo(1.5 * 0.0144, 9);
    expect(index.centre[1]).toBeCloseTo(51.5, 9);
  });

  test('gives other names by their language code, in order', () => {
    const index = new NetworkIndex(tinyNetwork());
    expect(index.otherNames({ name: 'D', names: { uk: 'Д', de: 'D-Bahnhof' } })).toEqual(['D-Bahnhof', 'Д']);
  });

  test('measures a segment along all its points, and reverses it without turning the original round', () => {
    const network = tinyNetwork();
    network.segments[0]!.coordinates = [
      [0, 51.5],
      [0.0072, 51.5],
      [0.0144, 51.5],
    ];
    const [segment] = new NetworkIndex(network).segments;
    expect(segment?.coordinates[0]).toEqual([0, 51.5]);
    expect(segment?.reversedCoordinates).toEqual([...segment!.coordinates].reverse());
    expect(segment?.lengthKm).toBeCloseTo(segment!.distances[2]!, 9);
    expect(segment?.lengthKm).toBeGreaterThan(segment!.distances[1]! * 1.5);
  });

  test("lists the lines a user can toggle in the network's order, leaving out one only an alias draws as", () => {
    const network = tinyNetwork();
    network.lines.ghost = { name: 'Ghost', network: 'metro', mode: 'metro', color: '#999999', pseudo: true };
    const index = new NetworkIndex(network);
    expect(index.lineIds).toEqual(['red', 'blue', 'pink', 'green']);
    expect(['green', 'pink', 'red', 'blue'].sort(index.compareLines)).toEqual(['red', 'blue', 'pink', 'green']);
  });
});
