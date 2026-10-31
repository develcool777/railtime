import { describe, expect, test } from 'vitest';
import { parseNetwork } from '../../../src/validation/network.schema';
import type { Network } from '../../../src/format/network.types';
import { plannedNetwork } from '../../support/factories/plannedNetwork.utils';

/**
 * The problems the validator reports.
 *
 * @param network - A network.
 * @returns Each problem's message; none for a valid network.
 */
const problemsOf = (network: Network): string[] => {
  try {
    parseNetwork(network);
    return [];
  } catch (error) {
    return (error as { issues: { message: string }[] }).issues.map(issue => issue.message);
  }
};

describe('NetworkSchema', () => {
  test("accepts a network with a plan, names in other languages, and a plan's section on a line of its own", () => {
    const network = plannedNetwork();
    network.lines.red!.names = { uk: 'Червона', 'pt-BR': 'Vermelha' };
    network.plans!.extension!.lines = { green: { name: 'Green', network: 'metro', mode: 'metro', color: '#00aa00' } };
    network.plans!.extension!.sections.push({ line: 'green', stations: ['c', 'd'] });
    expect(problemsOf(network)).toEqual([]);
    expect(problemsOf(plannedNetwork())).toEqual([]);
  });

  test('accepts a line drawn as another, a network with no plans, and a plan with no stations of its own', () => {
    const network = plannedNetwork();
    network.lines.pink = {
      name: 'Pink',
      network: 'metro',
      mode: 'metro',
      color: '#ff88cc',
      aliases: [{ until: '1950-01-01', as: 'red', text: 'Pink becomes its own line' }],
    };
    network.plans!.extension = { name: 'More red', status: 'concept', sections: [{ line: 'red', stations: ['c', 'a'] }] };
    expect(problemsOf(network)).toEqual([]);
    delete network.plans;
    expect(problemsOf(network)).toEqual([]);
  });

  test("refuses a plan's line the network already has", () => {
    const network = plannedNetwork();
    network.plans!.extension!.lines = { red: { name: 'Red again', network: 'metro', mode: 'metro', color: '#ff0000' } };
    expect(problemsOf(network)).toEqual(['plan extension: line red is already in the network']);
  });

  test("checks a plan's sections against the network and the plan", () => {
    const network = plannedNetwork();
    network.plans!.extension!.sections.push({ line: 'blue', stations: ['d', 'x'] });
    expect(problemsOf(network)).toEqual(['plan extension: section 2: unknown line blue', 'plan extension: section 2: unknown station x']);
  });

  test('refuses a plan reusing an id the network has', () => {
    const network = plannedNetwork();
    network.plans!.extension!.stations!.a = { name: 'Another A', coordinate: [0, 51.6] };
    expect(problemsOf(network)).toEqual(['plan extension: station a is already in the network']);
  });

  test("reports the network's own problems once, not again for each plan", () => {
    const network = plannedNetwork();
    network.transfers = [{ stationA: 'a', stationB: 'nowhere' }];
    expect(problemsOf(network)).toEqual(['transfer a – nowhere: unknown station nowhere']);
  });

  test("refuses track that misses its stations' dots, a few metres of rounding allowed", () => {
    const network = plannedNetwork();
    network.segments[0]!.coordinates[0] = [0.0001, 51.5];
    expect(problemsOf(network)).toEqual([]);
    network.segments[0]!.coordinates[0] = [0, 51.5005];
    // The plan's split of that segment, a – b, misses it too.
    expect(problemsOf(network)).toEqual(['segment a – c: its track ends 56 m from a', 'plan extension: segment a – b: its track ends 56 m from a']);
  });

  test('refuses a malformed part: a date, a colour, a language code, track of one point', () => {
    const network = plannedNetwork();
    network.meta.start = '1899-1-1';
    network.lines.red!.color = 'red';
    network.lines.red!.names = { Ukrainian: 'Червона' };
    network.segments[0]!.coordinates = [[0, 51.5]];
    expect(problemsOf(network)).toEqual([
      'expected YYYY-MM-DD',
      'expected a language code: uk, pt-BR, not Ukrainian',
      'expected #rrggbb',
      'Too small: expected array to have >=2 items',
      // The parts are checked even so: one point, at A, is far from C.
      'segment a – c: its track ends 1386 m from c',
      'plan extension: segment b – c: its track ends 702 m from c',
    ]);
  });

  test("refuses a line in a network that isn't there, or drawn as a line that isn't", () => {
    const network = plannedNetwork();
    network.lines.red!.network = 'tram';
    network.lines.red!.aliases = [{ until: '1950-01-01', as: 'blue', text: 'Red becomes its own line' }];
    expect(problemsOf(network)).toEqual(['line red: unknown network tram', 'line red: alias to unknown line blue']);
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

  test("refuses a transfer to a station that isn't, or to itself", () => {
    const network = plannedNetwork();
    network.transfers = [
      { stationA: 'a', stationB: 'z' },
      { stationA: 'a', stationB: 'a' },
    ];
    expect(problemsOf(network)).toEqual(['transfer a – z: unknown station z', 'transfer a: to itself']);
  });

  test("refuses a segment to a station or for a line that isn't, closing before it opens, or suspended out of order; once, though a plan moves it on", () => {
    const network = plannedNetwork();
    network.segments.push({
      stationA: 'c',
      stationB: 'z',
      lines: {
        red: { open: '1950-01-01', close: '1940-01-01' },
        blue: { open: '1950-01-01', suspended: [{ from: '1960-01-01', until: '1955-01-01' }] },
      },
      coordinates: [
        [0.02, 51.5],
        [0.03, 51.5],
      ],
    });
    expect(problemsOf(network)).toEqual([
      'segment c – z: unknown station z',
      'segment c – z: red closes before it opens',
      'segment c – z: red suspended out of order',
      'segment c – z: unknown line blue',
      'segment c – z: blue suspended out of order',
    ]);
  });

  test("refuses a plan whose network would be unsound: one of its lines in a network that isn't", () => {
    const network = plannedNetwork();
    network.plans!.extension!.lines = { green: { name: 'Green', network: 'tram', mode: 'tram', color: '#00aa00' } };
    expect(problemsOf(network)).toEqual(['plan extension: line green: unknown network tram']);
  });

  test("accepts every mode and status, a long description, a script's language code and former names in order, and keeps each part's fields", () => {
    const network = plannedNetwork();
    network.lines.red!.names = { 'zh-Hant': '紅線' };
    network.plans!.extension!.description = 'A line on to D';
    network.stations.a!.formerNames = [
      { name: 'First', until: '1920-01-01' },
      { name: 'Second', until: '1930-01-01' },
    ];
    for (const mode of ['metro', 'light-metro', 'tram', 'suburban-rail', 'rail', 'cable'] as const) {
      network.lines.red!.mode = mode;
      expect(problemsOf(network)).toEqual([]);
    }
    for (const status of ['under-construction', 'planned', 'proposed', 'concept', 'abandoned'] as const) {
      network.plans!.extension!.status = status;
      expect(problemsOf(network)).toEqual([]);
    }
    expect(parseNetwork(network).networks).toEqual({ metro: { name: 'Metro' } });
  });

  test('refuses a part malformed at its ends: text around a date or a colour, a word for a language, an empty description, a network with no name', () => {
    const network = plannedNetwork();
    network.meta.start = '1899-01-01x';
    network.meta.built = 'x2026-01-01';
    network.lines.red!.color = '#ff0000x';
    network.lines.red!.darkColor = 'x#ff0000';
    network.lines.red!.names = { ukrainian: 'Червона' };
    network.plans!.extension!.description = '';
    network.networks.metro = {} as never;
    expect(problemsOf(network)).toEqual([
      'expected YYYY-MM-DD',
      'expected YYYY-MM-DD',
      'Invalid input: expected string, received undefined',
      'expected a language code: uk, pt-BR, not ukrainian',
      'expected #rrggbb',
      'expected #rrggbb',
      'Too small: expected string to have >=1 characters',
    ]);
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

  test("checks a plan's sections against the network alone when the plan has no stations of its own", () => {
    const network = plannedNetwork();
    delete network.plans!.extension!.stations;
    network.plans!.extension!.sections = [{ line: 'red', stations: ['a', 'x'] }];
    expect(problemsOf(network)).toEqual(['plan extension: section 0: unknown station x']);
  });
});
