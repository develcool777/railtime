import { toTimestamp } from '@railtime/core/date.utils';
import { buildPlan } from '@railtime/schema/plan.utils';
import { lineId, networkId, planId, stationId } from '@railtime/schema/testing/ids';
import { describe, expect, test } from 'vitest';
import { NetworkIndex } from '../../../src/engine/index.service';
import { tinyNetwork } from '../../support/factories/tinyNetwork.utils';

describe('NetworkIndex', () => {
  test('names a station by its former name until the day it changed', () => {
    const index = new NetworkIndex(tinyNetwork());
    expect(index.stationName(stationId('d'), toTimestamp('1924-12-31'))).toBe('Old D');
    expect(index.stationName(stationId('d'), toTimestamp('1925-01-01'))).toBe('D');
    expect(index.stationName(stationId('d'))).toBe('D');
  });

  test('cuts a line out of its gaps, the pieces either side apart, a suspension still linking its periods', () => {
    const day = (date: string) => toTimestamp(date);
    const index = new NetworkIndex(tinyNetwork(), [], new Map([[lineId('blue'), [{ from: day('1932-01-01'), until: day('1935-01-01') }]]]));
    const [first, second, third, ...rest] = index.lineSegments.filter(lineSegment => lineSegment.line === 'blue');
    expect(rest).toEqual([]);
    expect(first).toMatchObject({ opens: day('1930-01-01'), closes: day('1932-01-01'), previous: null, next: null });
    expect(second).toMatchObject({ opens: day('1935-01-01'), closes: day('1940-01-01'), previous: null, next: third });
    expect(third).toMatchObject({ opens: day('1945-01-01'), closes: day('1950-01-01'), previous: second, next: null });
  });

  test('leaves a suspension unlinked where a gap cuts the period before it short', () => {
    const day = (date: string) => toTimestamp(date);
    const index = new NetworkIndex(tinyNetwork(), [], new Map([[lineId('blue'), [{ from: day('1938-01-01'), until: day('1942-01-01') }]]]));
    const periods = index.lineSegments.filter(lineSegment => lineSegment.line === 'blue');
    expect(periods.map(period => [period.opens, period.closes, period.previous !== null])).toEqual([
      [day('1930-01-01'), day('1938-01-01'), false],
      [day('1945-01-01'), day('1950-01-01'), false],
    ]);
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
    expect(index.transfersAt(stationId('a'))).toEqual(['d']);
    expect(index.transfersAt(stationId('d'))).toEqual(['a']);
    expect(index.transfersAt(stationId('b'))).toEqual([]);
  });

  test('labels a station with its name, then its names in other languages, as of a date', () => {
    const index = new NetworkIndex(tinyNetwork());
    expect(index.stationLabel(stationId('d'))).toBe('D\nД');
    expect(index.stationLabel(stationId('d'), toTimestamp('1924-12-31'))).toBe('Old D\nСтарий Д');
    expect(index.stationLabel(stationId('c'))).toBe('C');
    expect(index.stationName(stationId('d'))).toBe('D');
    expect(index.lineName(lineId('red'))).toBe('Red line');
  });

  test('names a line by its full name where "<name> line" is not what people say', () => {
    const network = tinyNetwork();
    network.lines[lineId('red')] = { ...network.lines[lineId('red')]!, fullName: 'Red Light Railway' };
    expect(new NetworkIndex(network).lineName(lineId('red'))).toBe('Red Light Railway');
  });

  test('leaves out another name that is the same as the English one', () => {
    const index = new NetworkIndex(tinyNetwork());
    expect(index.otherNames({ name: 'Arena', names: { uk: 'Арена', pl: 'Arena' } })).toEqual(['Арена']);
  });

  test('knows when each line first ran as itself, and that a line only a plan builds has not', () => {
    const network = tinyNetwork();
    network.plans![planId('newLine')] = {
      name: 'New line',
      status: 'planned',
      lines: { [lineId('purple')]: { name: 'Purple', network: networkId('metro'), mode: 'metro', color: '#800080' } },
      sections: [{ line: lineId('purple'), stations: [stationId('a'), stationId('b')] }],
    };
    const plan = buildPlan(network, planId('newLine'));
    const index = new NetworkIndex(plan.network, plan.sections);
    expect(index.lineOpens(lineId('red'))).toBe(toTimestamp('1900-01-01'));
    expect(index.lineOpens(lineId('green'))).toBe(toTimestamp('1970-01-01'));
    // Drawn as red until 1990.
    expect(index.lineOpens(lineId('pink'))).toBe(toTimestamp('1990-01-01'));
    expect(index.lineOpens(lineId('purple'))).toBe(Infinity);
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
    expect(segment?.reversedCoordinates).toEqual([...segment!.coordinates].toReversed());
    expect(segment?.lengthKm).toBeCloseTo(segment!.distances[2]!, 9);
    expect(segment?.lengthKm).toBeGreaterThan(segment!.distances[1]! * 1.5);
  });

  test("lists the lines a user can toggle in the network's order, leaving out one only an alias draws as", () => {
    const network = tinyNetwork();
    network.lines[lineId('ghost')] = { name: 'Ghost', network: networkId('metro'), mode: 'metro', color: '#999999', pseudo: true };
    const index = new NetworkIndex(network);
    expect(index.lineIds).toEqual(['red', 'blue', 'pink', 'green']);
    expect(['green', 'pink', 'red', 'blue'].map(lineId).toSorted(index.compareLines)).toEqual(['red', 'blue', 'pink', 'green']);
  });
});
