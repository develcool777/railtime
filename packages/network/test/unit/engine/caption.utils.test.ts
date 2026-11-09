import { toTimestamp } from '@railtime/core/date.utils';
import type { Network } from '@railtime/schema/network.types';
import { lineId, stationId } from '@railtime/schema/testing/ids';
import { describe, expect, test } from 'vitest';
import { captionOf } from '../../../src/engine/caption.utils';
import { engineOf } from '../../../src/engine/engine.utils';
import { tinyNetwork } from '../../support/factories/tinyNetwork.utils';
import { factsOf } from '../../support/facts.utils';

/**
 * The caption of the first change after a day.
 *
 * @param network - The network.
 * @param date - The day before it.
 * @returns Its caption.
 */
const captionAfter = (network: Network, date: string) => {
  const facts = factsOf(network);
  const step = engineOf(facts).timeline.steps[engineOf(facts).timeline.cursorAt(toTimestamp(date))]!;
  return captionOf(step, { index: engineOf(facts).index, timeline: engineOf(facts).timeline });
};

describe('CaptionUtils', () => {
  describe('captionOf', () => {
    test('says a line opens, extended from the station it grows from to the last, naming the stations it opens as they were called then', () => {
      // D opened in 1910 under its name then, Old D; red runs through C, but calls there only from 1920.
      expect(captionAfter(tinyNetwork(), '1905-01-01')).toMatchObject({
        kind: 'open',
        title: 'Red line extended',
        subtitle: 'B – Old D',
        stations: ['Old D'],
      });
    });

    test('names an extension leaving its line where it does not call from the station before', () => {
      // Blue runs B – C from 1930 but never calls at C: its 1935 extension on to E is named from B.
      const network = tinyNetwork();
      network.stations[stationId('e')] = { name: 'E', coordinate: [2 * 0.0144, 51.509] };
      network.segments.push({
        stationA: stationId('c'),
        stationB: stationId('e'),
        lines: { [lineId('blue')]: { open: '1935-01-01' } },
        coordinates: [network.stations[stationId('c')]!.coordinate, network.stations[stationId('e')]!.coordinate],
      });
      expect(captionAfter(network, '1934-01-01')).toMatchObject({ title: 'Blue line extended', subtitle: 'B – E' });
    });

    test('names an extension ending where its line does not call yet by its last stop', () => {
      // Blue on from C, where it never calls, by E to F, a station only from 1960: named B – E.
      const network = tinyNetwork();
      network.stations[stationId('e')] = { name: 'E', coordinate: [2 * 0.0144, 51.509] };
      network.stations[stationId('f')] = { name: 'F', coordinate: [2 * 0.0144, 51.518], infill: { [lineId('blue')]: '1960-01-01' } };
      network.segments.push(
        {
          stationA: stationId('c'),
          stationB: stationId('e'),
          lines: { [lineId('blue')]: { open: '1935-01-01' } },
          coordinates: [network.stations[stationId('c')]!.coordinate, network.stations[stationId('e')]!.coordinate],
        },
        {
          stationA: stationId('e'),
          stationB: stationId('f'),
          lines: { [lineId('blue')]: { open: '1935-01-01' } },
          coordinates: [network.stations[stationId('e')]!.coordinate, network.stations[stationId('f')]!.coordinate],
        },
      );
      expect(captionAfter(network, '1934-01-01')).toMatchObject({ title: 'Blue line extended', subtitle: 'B – E' });
    });

    test('says a line opens though another already runs there, and one back on track it left reopens', () => {
      // B and C are both on the map: the stretch grows one way, from C, nearer the centre.
      expect(captionAfter(tinyNetwork(), '1929-01-01')).toMatchObject({ title: 'Blue line opens', subtitle: 'C – B' });
      expect(captionAfter(tinyNetwork(), '1944-01-01')).toMatchObject({ title: 'Blue line reopens', subtitle: 'C – B' });
    });

    test('says a section is suspended when its line will return, and closes when it will not', () => {
      expect(captionAfter(tinyNetwork(), '1939-01-01')).toEqual({
        kind: 'close',
        time: toTimestamp('1940-01-01'),
        title: 'Blue line: section suspended',
        subtitle: 'C – B',
        color: { light: '#0000ff', dark: '#0000ff' },
        stations: [],
      });
      expect(captionAfter(tinyNetwork(), '1949-01-01')).toMatchObject({ title: 'Blue line: section closes', subtitle: 'C – B' });
    });

    test('says a station opens on its line, and on every line it opens on', () => {
      expect(captionAfter(tinyNetwork(), '1915-01-01')).toEqual({
        kind: 'infill',
        time: toTimestamp('1920-06-01'),
        title: 'C opens',
        subtitle: 'on the Red line',
        color: { light: '#ff0000', dark: '#ff0000' },
        stations: ['C'],
      });
      const network = tinyNetwork();
      network.stations[stationId('c')]!.infill = { [lineId('red')]: '1935-01-01', [lineId('blue')]: '1935-01-01' };
      expect(captionAfter(network, '1934-01-01')).toMatchObject({ subtitle: 'on the Red line and Blue line' });
    });

    test('says a station closes on the line that stops calling there', () => {
      expect(captionAfter(tinyNetwork(), '1959-01-01')).toMatchObject({
        kind: 'stationClose',
        time: toTimestamp('1960-01-01'),
        title: 'D closes',
        subtitle: 'on the Red line',
        stations: [],
      });
    });

    test('says a station closes for a spell, and reopens', () => {
      const network = tinyNetwork();
      network.stations[stationId('b')] = {
        ...network.stations[stationId('b')]!,
        suspended: { [lineId('red')]: [{ from: '1915-03-15', until: '1926-07-19' }] },
      };
      expect(captionAfter(network, '1915-01-01')).toMatchObject({ kind: 'stationClose', title: 'B closes temporarily', stations: [] });
      expect(captionAfter(network, '1926-01-01')).toMatchObject({ kind: 'infill', title: 'B reopens', stations: ['B'] });
    });

    test('says what a station was called and is now', () => {
      expect(captionAfter(tinyNetwork(), '1924-01-01')).toEqual({
        kind: 'rename',
        time: toTimestamp('1925-01-01'),
        title: 'Old D renamed',
        subtitle: 'now D',
        color: { light: '#ff0000', dark: '#ff0000' },
        stations: ['D'],
      });
    });

    test("says a line takes its own identity in the data's words", () => {
      expect(captionAfter(tinyNetwork(), '1989-01-01')).toEqual({
        kind: 'identity',
        time: toTimestamp('1990-01-01'),
        title: 'Pink becomes its own line',
        color: { light: '#ff88cc', dark: '#ff88cc' },
        stations: [],
      });
    });
  });
});
