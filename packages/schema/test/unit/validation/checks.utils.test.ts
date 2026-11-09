import { describe, expect, test } from 'vitest';
import { checkNetwork } from '../../../src/validation/checks.utils';
import { plannedNetwork } from '../../support/factories/plannedNetwork.utils';
import { asNetwork } from '../../support/ids.utils';
import type { WrittenNetwork } from '../../support/ids.utils';

/**
 * The problems the checks between a network's parts reports.
 *
 * @param network - A network, as its file is written.
 * @returns Each problem's message; none for a sound network.
 */
const problemsOf = (network: WrittenNetwork): string[] => {
  const problems: string[] = [];
  checkNetwork(asNetwork(network), message => {
    problems.push(message);
  });
  return problems;
};

describe('ChecksUtils', () => {
  test("refuses track that misses its stations' dots, a few metres of rounding allowed", () => {
    const network = plannedNetwork();
    network.segments[0]!.coordinates[0] = [0.0001, 51.5];
    expect(problemsOf(network)).toEqual([]);
    network.segments[0]!.coordinates[0] = [0, 51.5005];
    expect(problemsOf(network)).toEqual(['segment a – c: its track ends 55 m from a']);
  });

  test('refuses track that doubles back on itself: a point run past a station, pulled back to it', () => {
    const network = plannedNetwork();
    // About 35 m past C, then back.
    network.segments[0]!.coordinates = [
      [0, 51.5],
      [0.0205, 51.5],
      [0.02, 51.5],
    ];
    expect(problemsOf(network)).toContain('segment a – c: its track turns 180° at point 1, sharper than its trains can');
    // A bend is track: through B, where the plan puts its station.
    network.segments[0]!.coordinates = [
      [0, 51.5],
      [0.01, 51.501],
      [0.02, 51.5],
    ];
    expect(problemsOf(network).filter(message => message.includes('sharper'))).toEqual([]);
  });

  test("refuses a turn sharper than the line's trains take: a metro's corner is a tram's street corner", () => {
    const network = plannedNetwork();
    // East, back north-north-west for 95 m, then east again: two corners a metro cannot take.
    network.segments[0]!.coordinates = [
      [0, 51.5],
      [0.012, 51.5],
      [0.0115, 51.5008],
      [0.02, 51.5],
    ];
    expect(problemsOf(network)).toContainEqual(expect.stringMatching(/^segment a – c: its track turns 1[12]\d° at point 2, sharper than its trains can$/));
    network.lines.red!.mode = 'tram';
    expect(problemsOf(network).filter(message => message.includes('sharper'))).toEqual([]);
  });

  test('refuses a line turning back through a station, unless its trains reverse there or never ran both ways at once', () => {
    const network = plannedNetwork();
    network.stations.e = { name: 'E', coordinate: [0.01, 51.5002] };
    network.segments.push({
      stationA: 'c',
      stationB: 'e',
      lines: { red: { open: '1910-01-01' } },
      coordinates: [
        [0.02, 51.5],
        [0.01, 51.5002],
      ],
    });
    expect(problemsOf(network)).toContainEqual(expect.stringMatching(/^station c: red turns 17\d° through it, sharper than its trains can$/));
    network.stations.c!.reverses = ['red'];
    expect(problemsOf(network).filter(message => message.includes('sharper'))).toEqual([]);
    delete network.stations.c!.reverses;
    network.segments[0]!.lines.red!.close = '1905-01-01';
    expect(problemsOf(network).filter(message => message.includes('sharper'))).toEqual([]);
    network.stations.c!.reverses = ['blue'];
    expect(problemsOf(network)).toContain('station c: reverses unknown line blue');
  });

  test("refuses a line in a network that isn't there, or drawn as a line that isn't", () => {
    const network = plannedNetwork();
    network.lines.red!.network = 'tram';
    network.lines.red!.aliases = [{ until: '1950-01-01', as: 'blue', text: 'Red becomes its own line' }];
    expect(problemsOf(network)).toEqual(['line red: unknown network tram', 'line red: alias to unknown line blue']);
  });

  test('refuses aliases out of order: what a line is drawn as reads them by when they end', () => {
    const network = plannedNetwork();
    network.networks.metro = { name: 'Metro' };
    network.lines.blue = { name: 'Blue', network: 'metro', mode: 'metro', color: '#0000ff' };
    network.lines.red!.aliases = [
      { until: '1950-01-01', as: 'blue', text: 'Red goes back to Blue' },
      { until: '1940-01-01', as: 'blue', text: 'Red becomes its own line' },
    ];
    expect(problemsOf(network)).toEqual(['line red: aliases out of order']);
    network.lines.red!.aliases = network.lines.red!.aliases.toReversed();
    expect(problemsOf(network)).toEqual([]);
  });

  test('refuses a line opening before its timeline starts, and a start of its own on a network not hidden at first or no older than the city', () => {
    const network = plannedNetwork();
    network.segments[0]!.lines.red = { open: '1890-01-01' };
    network.networks.metro = { ...network.networks.metro!, start: '1880-01-01' };
    network.networks.rail = { name: 'Rail', hidden: true, start: '1900-01-01' };
    expect(problemsOf(network)).toEqual([
      'network metro: a start of its own, 1880-01-01, but it is not a network hidden at first, older than the city',
      'network rail: a start of its own, 1900-01-01, but it is not a network hidden at first, older than the city',
      'segment a – c: red opens before its timeline starts, 1899-01-01',
    ]);
  });

  test('accepts a network hidden at first, older than the city, from its own start', () => {
    const network = plannedNetwork();
    network.networks.rail = { name: 'Rail', hidden: true, start: '1850-01-01' };
    network.lines.green = { name: 'Green', network: 'rail', mode: 'suburban-rail', color: '#00aa00' };
    network.segments[0]!.lines.green = { open: '1860-01-01' };
    expect(problemsOf(network)).toEqual([]);
  });

  test('accepts a station closed for a while on a line running through it, and refuses a spell out of turn', () => {
    const network = plannedNetwork();
    network.stations.c = { ...network.stations.c!, suspended: { red: [{ from: '1915-03-15', until: '1926-07-19' }] } };
    expect(problemsOf(network)).toEqual([]);
    network.stations.c.infill = { red: '1920-01-01' };
    network.stations.c.suspended = {
      red: [
        { from: '1930-01-01', until: '1925-01-01' },
        { from: '1924-01-01', until: '1940-01-01' },
        { from: '1890-01-01', until: '1895-01-01' },
      ],
      blue: [{ from: '1930-01-01', until: '1931-01-01' }],
    };
    expect(problemsOf(network)).toEqual([
      'station c: closed for a while on red, 1930-01-01 – 1925-01-01, ending before it starts',
      'station c: closed for a while on red, 1924-01-01 – 1940-01-01, before the spell ahead of it ends',
      'station c: closed for a while on red, 1890-01-01 – 1895-01-01, before the spell ahead of it ends',
      "station c: closed for a while on red, 1890-01-01 – 1895-01-01, when it doesn't run there",
      'station c: closed for a while on red, 1890-01-01 – 1895-01-01, outside when the station is open on it',
      'station c: closed for a while on blue, an unknown line',
    ]);
  });

  test("refuses a station closing on a line that isn't, or before it opened there, and former names out of order", () => {
    const network = plannedNetwork();
    network.stations.a = {
      ...network.stations.a!,
      infill: { red: '1950-01-01' },
      closed: { red: '1950-01-01', blue: '1960-01-01' },
      formerNames: [
        { name: 'Later', until: '1930-01-01' },
        { name: 'Earlier', until: '1920-01-01' },
      ],
    };
    expect(problemsOf(network)).toEqual([
      'station a: closes on red before it opens',
      'station a: closed on unknown line blue',
      'station a: former names out of order',
    ]);
  });

  test("refuses a station opening on a line before it runs there or on one that never does, and closing when it doesn't run there", () => {
    const network = plannedNetwork();
    network.segments[0]!.lines.red!.close = '1950-01-01';
    network.stations.a = { ...network.stations.a!, infill: { red: '1890-01-01' } };
    network.stations.c = { ...network.stations.c!, infill: { blue: '1920-01-01' }, closed: { red: '1950-01-01' } };
    expect(problemsOf(network)).toEqual([
      'station a: opens on red on 1890-01-01, before the line runs there',
      "station c: opens on blue on 1920-01-01, which doesn't run there",
      "station c: closes on red on 1950-01-01, when it doesn't run there",
    ]);
  });

  test('accepts a station opening on a line after the line has left: the line never called there', () => {
    const network = plannedNetwork();
    network.segments[0]!.lines.red!.close = '1950-01-01';
    network.stations.a = { ...network.stations.a!, infill: { red: '1960-01-01' } };
    expect(problemsOf(network)).toEqual([]);
  });

  test('accepts a line passing a station without calling, and refuses one passing where it does not run, an unknown one, or one also dated calling', () => {
    const network = plannedNetwork();
    network.stations.a = { ...network.stations.a!, passes: ['red'] };
    expect(problemsOf(network)).toEqual([]);
    network.lines.blue = { name: 'Blue', network: 'metro', mode: 'metro', color: '#0000ff' };
    network.segments[0]!.lines.red!.close = '1950-01-01';
    network.stations.a = { ...network.stations.a, passes: ['nowhere', 'blue'] };
    network.stations.c = { ...network.stations.c!, passes: ['red'], infill: { red: '1960-01-01' } };
    expect(problemsOf(network)).toEqual([
      'station a: passed by unknown line nowhere',
      "station a: passed by blue, which doesn't run there",
      'station c: passed by red, which it also dates calling there',
    ]);
  });

  test("refuses a transfer to a station that isn't, or to itself", () => {
    const network = plannedNetwork();
    network.transfers = [
      { stationA: 'a', stationB: 'z' },
      { stationA: 'a', stationB: 'a' },
    ];
    expect(problemsOf(network)).toEqual(['transfer a – z: unknown station z', 'transfer a: to itself']);
  });

  test('refuses tracks that do not hold each of a segment’s lines once, and only its lines', () => {
    const twice = plannedNetwork();
    twice.segments[0]!.tracks = [['red', 'red'], ['blue']];
    expect(problemsOf(twice)).toEqual(['segment a – c: red on more than one of its tracks', 'segment a – c: blue on its tracks, not among its lines']);
    const missing = plannedNetwork();
    missing.segments[0]!.tracks = [['blue'], ['green']];
    expect(problemsOf(missing)).toContain('segment a – c: red on none of its tracks');
  });

  test('checks station dates at their edges: on the day a line opens or closes there, on a line through it at one end only', () => {
    const network = plannedNetwork();
    network.lines.blue = { name: 'Blue', network: 'metro', mode: 'metro', color: '#0000ff' };
    network.stations.e = { name: 'E', coordinate: [0.03, 51.5] };
    network.segments[0]!.lines.red!.close = '1955-01-01';
    network.segments.push({
      stationA: 'c',
      stationB: 'e',
      lines: { red: { open: '1950-01-01' }, blue: { open: '1900-01-01', close: '1990-01-01' } },
      coordinates: [
        [0.02, 51.5],
        [0.03, 51.5],
      ],
    });
    // Sound: opening the day the line came, opening while one of its segments here runs, closing after it opened
    // while one runs, closing before the line's own close.
    network.stations.a = { ...network.stations.a!, infill: { red: '1900-01-01' } };
    network.stations.c = { ...network.stations.c!, infill: { red: '1920-01-01' }, closed: { red: '1960-01-01' } };
    network.stations.e = { ...network.stations.e, closed: { blue: '1950-06-01' } };
    expect(problemsOf(network)).toEqual([]);
    // Unsound: opening before the line reaches the far end, closing the day it comes, former names on one day.
    network.stations.e = { ...network.stations.e, infill: { red: '1940-01-01' }, closed: { red: '1950-01-01' } };
    network.stations.a.formerNames = [
      { name: 'First', until: '1920-01-01' },
      { name: 'Second', until: '1920-01-01' },
    ];
    expect(problemsOf(network)).toEqual([
      'station a: former names out of order',
      'station e: opens on red on 1940-01-01, before the line runs there',
      "station e: closes on red on 1950-01-01, when it doesn't run there",
    ]);
  });

  test('refuses segment dates on one day: a close the day it opens, a suspension from the day it opens', () => {
    const network = plannedNetwork();
    network.lines.blue = { name: 'Blue', network: 'metro', mode: 'metro', color: '#0000ff' };
    network.stations.e = { name: 'E', coordinate: [0.03, 51.5] };
    network.segments.push({
      stationA: 'c',
      stationB: 'e',
      lines: { red: { open: '1950-01-01', close: '1950-01-01' }, blue: { open: '1950-01-01', suspended: [{ from: '1950-01-01', until: '1960-01-01' }] } },
      coordinates: [
        [0.02, 51.5],
        [0.03, 51.5],
      ],
    });
    expect(problemsOf(network)).toEqual([
      'segment c – e: red closes before it opens',
      'segment c – e: red suspended out of order',
      'segment c – e: blue suspended out of order',
    ]);
  });
});
