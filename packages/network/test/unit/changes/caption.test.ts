import type { Network } from '@railtime/schema/network.types';
import { describe, expect, test } from 'vitest';
import { captionOf } from '../../../src/changes/caption.utils';
import { toTimestamp } from '../../../src/core/date.utils';
import { tinyNetwork } from '../../support/factories/tinyNetwork.utils';
import { modelOf } from '../../support/model.utils';

/**
 * The caption of the first change after a day, in the light theme's colours.
 *
 * @param network - The network.
 * @param date - The day before it.
 * @returns Its caption.
 */
const captionAfter = (network: Network, date: string) => {
  const model = modelOf(network);
  const step = model.timeline.steps[model.timeline.cursorAt(toTimestamp(date))]!;
  return captionOf(step, { index: model.index, timeline: model.timeline, colorOf: line => model.colorOf(line, 'light') });
};

describe('CaptionUtils', () => {
  describe('captionOf', () => {
    test('says a line opens, extended from the station it grows from to the last, naming the stations it opens as they were called then', () => {
      // D opened in 1910 under its name then, Old D; C is an infill station, named as the front passes it.
      expect(captionAfter(tinyNetwork(), '1905-01-01')).toMatchObject({
        kind: 'open',
        title: 'Red line extended',
        subtitle: 'B – Old D',
        stations: ['C', 'Old D'],
      });
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
        subtitle: 'B – C',
        color: '#0000ff',
        stations: [],
      });
      expect(captionAfter(tinyNetwork(), '1949-01-01')).toMatchObject({ title: 'Blue line: section closes', subtitle: 'B – C' });
    });

    test('says a station opens on its line, and on every line it opens on', () => {
      expect(captionAfter(tinyNetwork(), '1915-01-01')).toEqual({
        kind: 'infill',
        time: toTimestamp('1920-06-01'),
        title: 'C opens',
        subtitle: 'on the Red line',
        color: '#ff0000',
        stations: ['C'],
      });
      const network = tinyNetwork();
      network.stations.c!.infill = { red: '1935-01-01', blue: '1935-01-01' };
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

    test('says what a station was called and is now', () => {
      expect(captionAfter(tinyNetwork(), '1924-01-01')).toEqual({
        kind: 'rename',
        time: toTimestamp('1925-01-01'),
        title: 'Old D renamed',
        subtitle: 'now D',
        color: '#ff0000',
        stations: ['D'],
      });
    });

    test("says a line takes its own identity in the data's words", () => {
      expect(captionAfter(tinyNetwork(), '1989-01-01')).toEqual({
        kind: 'identity',
        time: toTimestamp('1990-01-01'),
        title: 'Pink becomes its own line',
        color: '#ff88cc',
        stations: [],
      });
    });
  });
});
