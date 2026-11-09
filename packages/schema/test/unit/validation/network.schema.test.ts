import { describe, expect, test } from 'vitest';
import { parseNetwork } from '../../../src/validation/network.schema';
import { plannedNetwork } from '../../support/factories/plannedNetwork.utils';
import type { WrittenNetwork } from '../../support/ids.utils';

/**
 * The problems the validator reports.
 *
 * @param network - A network, as its file is written.
 * @returns Each problem's message; none for a valid network.
 */
const problemsOf = (network: WrittenNetwork): string[] => {
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

  test("reports the network's own problems once, not again for each plan", () => {
    const network = plannedNetwork();
    network.transfers = [{ stationA: 'a', stationB: 'nowhere' }];
    expect(problemsOf(network)).toEqual(['transfer a – nowhere: unknown station nowhere']);
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

  test('refuses a segment saying its lines are all on one track: that is said by saying nothing', () => {
    const one = plannedNetwork();
    one.segments[0]!.tracks = [['red']];
    expect(problemsOf(one)).toEqual(['Too small: expected array to have >=2 items']);
  });
});
