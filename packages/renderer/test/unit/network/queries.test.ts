import { describe, expect, test } from 'vitest';
import { toTimestamp } from '../../../src/core/date.utils';
import { NetworkQueries } from '../../../src/network/queries.service';
import type { NetworkMoment } from '../../../src/network/queries.types';
import { tinyNetwork } from '../../support/factories/tinyNetwork.utils';
import { playbackOf } from '../../support/playback.utils';

/**
 * The queries on the tiny network, and its moment on a date.
 *
 * @param date - The date shown.
 * @returns The queries and the moment.
 */
const queriesOn = (date: string) => {
  const playback = playbackOf(tinyNetwork());
  playback.player.seek(toTimestamp(date));
  const moment: NetworkMoment = { cursor: playback.player.cursor, clock: playback.player.clock, colorOf: line => playback.index.lineOf(line).color };
  return { queries: new NetworkQueries(playback.index, playback.timeline, playback.player.today), moment, playback };
};

describe('NetworkQueries', () => {
  test('lists every line, with its network, colour and opening as a line of its own', () => {
    const { queries } = queriesOn('1935-01-01');
    expect(queries.lines(() => '#123456')).toEqual([
      { id: 'red', name: 'Red', network: 'metro', networkName: 'Metro', color: '#123456', opened: toTimestamp('1900-01-01') },
      { id: 'blue', name: 'Blue', network: 'metro', networkName: 'Metro', color: '#123456', opened: toTimestamp('1930-01-01') },
      { id: 'pink', name: 'Pink', network: 'metro', networkName: 'Metro', color: '#123456', opened: toTimestamp('1990-01-01') },
      { id: 'green', name: 'Green', network: 'metro', networkName: 'Metro', color: '#123456', opened: toTimestamp('1970-01-01') },
    ]);
  });

  test("gives a line's stops in order under the names of the date, its length and the changes that made it", () => {
    const { queries, moment, playback } = queriesOn('1915-01-01');
    const red = queries.lineDetails('red', moment);
    expect(red.branches).toEqual([
      [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
        { id: 'd', name: 'Old D' },
      ],
    ]);
    expect(red).toMatchObject({ stations: 3, color: '#ff0000' });
    expect(red.km).toBeCloseTo(3, 1);
    expect(red.changes.map(change => playback.timeline.steps[change]?.kind)).toContain('open');
    expect(() => queries.lineDetails('purple', moment)).toThrow('Missing line purple');
  });

  test("tells a station's lines with their dates, its names then, and where it changes to", () => {
    const { queries, moment } = queriesOn('1935-01-01');
    // Green reaches D only after D closed: it passes D by, and is not one of its lines.
    expect(queries.stationInfo('d', moment)).toEqual({
      id: 'd',
      name: 'D',
      otherNames: ['Д'],
      lines: [{ id: 'red', name: 'Red line', color: '#ff0000', opened: '1910-01-01', closed: '1960-01-01' }],
      formerNames: [{ name: 'Old D', otherNames: ['Старий Д'], until: '1925-01-01' }],
      // Pink is still drawn as red at A: one line.
      transfers: [{ id: 'a', name: 'A', lines: [{ id: 'red', name: 'Red line', color: '#ff0000' }] }],
    });
    // Before it was renamed: its old name, no former ones.
    const early = queriesOn('1915-01-01');
    expect(early.queries.stationInfo('d', early.moment)).toMatchObject({ name: 'Old D', formerNames: [] });
    // A line whose track there closed has closed there; an infill station opened on a line on its own date.
    const later = queriesOn('1955-01-01');
    expect(later.queries.stationInfo('c', later.moment).lines).toEqual([
      { id: 'red', name: 'Red line', color: '#ff0000', opened: '1920-06-01' },
      { id: 'green', name: 'Green line', color: '#00aa00', opened: '1970-01-01' },
    ]);
  });

  test('makes no transfer to a station no line calls at yet', () => {
    const { queries, moment } = queriesOn('1905-01-01');
    expect(queries.stationInfo('a', moment).transfers).toEqual([]);
  });

  test('lists the stations a line calls at for a search, by name, with their colours', () => {
    const { queries, moment } = queriesOn('1935-01-01');
    expect(queries.stations(moment).map(station => [station.id, station.name, station.colors])).toEqual([
      ['a', 'A', ['#ff0000', '#ff88cc']],
      ['b', 'B', ['#ff0000', '#0000ff', '#ff88cc']],
      // Blue runs through C but never called there.
      ['c', 'C', ['#ff0000']],
      ['d', 'D', ['#ff0000']],
    ]);
    expect(queries.stations(moment).find(station => station.id === 'd')?.otherNames).toEqual(['Д']);
    // In 1915 the line passes C by: not one to look for.
    const early = queriesOn('1915-01-01');
    expect(early.queries.stations(early.moment).map(station => station.id)).toEqual(['a', 'b', 'd']);
  });

  test("finds a route with the stops' names of the date, and none where nothing runs", () => {
    const { queries, moment } = queriesOn('1935-01-01');
    const route = queries.route('a', 'd', 'fastest', moment);
    expect(route).toMatchObject({ from: { id: 'a', name: 'A' }, to: { id: 'd', name: 'D' }, changes: 0 });
    expect(route?.legs).toEqual([expect.objectContaining({ kind: 'ride', line: 'red', lineName: 'Red line', color: '#ff0000' })]);
    expect(route?.segments).toEqual([[0, 1, 2]]);
    const before = queriesOn('1899-06-01');
    expect(before.queries.route('a', 'd', 'fastest', before.moment)).toBeNull();
  });

  test('times every station from one, soonest first, each in its band; nothing from a station no line calls at', () => {
    const { queries, moment } = queriesOn('1935-01-01');
    const reach = queries.reach('a', moment);
    expect(reach?.from).toEqual({ id: 'a', name: 'A' });
    expect(reach?.stations.map(station => station.id)).toEqual(['b', 'c', 'd']);
    expect(reach?.stations.every(station => station.band === 0)).toBe(true);
    const before = queriesOn('1899-06-01');
    expect(before.queries.reach('a', before.moment)).toBeNull();
  });

  test('tells how the network grew, worked out once, and its records on the date', () => {
    const { queries, moment } = queriesOn('1935-01-01');
    const growth = queries.growth();
    expect(queries.growth().years).toBe(growth.years);
    expect(growth.years.slice(0, 2)).toEqual([
      { year: 1899, stations: 0, km: 0, lines: 0 },
      { year: 1900, stations: 2, km: expect.closeTo(1, 1), lines: 1 },
    ]);
    expect(growth.decades.slice(0, 3)).toEqual([
      { decade: 1900, stations: 2 },
      { decade: 1910, stations: 1 },
      { decade: 1920, stations: 1 },
    ]);
    const records = queries.records(2, moment);
    expect(records.oldest.map(station => station.id)).toEqual(['a', 'b']);
    expect(records.busiest[0]).toMatchObject({ id: 'b', lines: [{ id: 'red' }, { id: 'blue' }] });
    expect(records.longest.map(line => line.id)).toEqual(['red', 'blue']);
  });

  test('dates a line closed at a station when all its track there has, before 1970 too', () => {
    // Blue left B – C in 1950, after a spell away in the 1940s.
    const { queries, moment } = queriesOn('1955-01-01');
    expect(queries.stationInfo('b', moment).lines).toEqual([
      { id: 'red', name: 'Red line', color: '#ff0000', opened: '1900-01-01' },
      { id: 'pink', name: 'Pink line', color: '#ff88cc', opened: '1900-01-01' },
      { id: 'blue', name: 'Blue line', color: '#0000ff', opened: '1930-01-01', closed: '1950-01-01' },
    ]);
  });

  test("lists a plan's undated line at a station of its own, and a former name from the day it was dropped", () => {
    const playback = playbackOf(tinyNetwork(), 'extension');
    playback.player.seekEnd();
    const queries = new NetworkQueries(playback.index, playback.timeline, playback.player.today);
    const moment: NetworkMoment = { cursor: playback.player.cursor, clock: playback.player.clock, colorOf: () => '#ff0000' };
    expect(queries.stationInfo('e', moment).lines).toEqual([{ id: 'red', name: 'Red line', color: '#ff0000', opened: null }]);
    const renamed = queriesOn('1925-01-01');
    expect(renamed.queries.stationInfo('d', renamed.moment).formerNames.map(former => former.name)).toEqual(['Old D']);
  });

  test("keeps a line's changes to its own", () => {
    const { queries, moment, playback } = queriesOn('1935-01-01');
    const blueOpens = playback.timeline.steps.find(step => step.kind === 'open' && step.line === 'blue')!.index;
    expect(queries.lineDetails('red', moment).changes).not.toContain(blueOpens);
    expect(queries.lineDetails('blue', moment).changes).toContain(blueOpens);
  });

  test('ranks the records: oldest by year then name, busiest by lines, longest by km, lines with no track left out', () => {
    const { queries, moment } = queriesOn('1935-01-01');
    const records = queries.records(10, moment);
    expect(records.oldest.map(station => [station.id, station.year])).toEqual([
      ['a', 1900],
      ['b', 1900],
      ['d', 1910],
      ['c', 1920],
    ]);
    expect(records.busiest.map(station => station.id)).toEqual(['b', 'a', 'c', 'd']);
    // Green has no track yet: it is not a line to rank.
    expect(records.longest.map(line => line.id)).toEqual(['red', 'blue', 'pink']);
  });

  test('lists stations for a search by their names, not their ids', () => {
    const network = tinyNetwork();
    network.stations.a!.name = 'Zed';
    const playback = playbackOf(network);
    playback.player.seek(toTimestamp('1935-01-01'));
    const queries = new NetworkQueries(playback.index, playback.timeline, playback.player.today);
    const moment: NetworkMoment = { cursor: playback.player.cursor, clock: playback.player.clock, colorOf: () => '#ff0000' };
    expect(queries.stations(moment).map(station => station.name)).toEqual(['B', 'C', 'D', 'Zed']);
  });
});
