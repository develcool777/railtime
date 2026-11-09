import { keysOf } from '@railtime/core/collection.utils';
import { toTimestamp } from '@railtime/core/date.utils';
import type { LineId } from '@railtime/schema/network.types';
import { lineId, networkId, planId, stationId } from '@railtime/schema/testing/ids';
import { describe, expect, test } from 'vitest';
import { firstPlanOf, isPlanOnly, linesHiddenAtFirst, linesNamed, networkChoicesOf, withLinesHidden } from '../../../src/facts/networks.utils';
import { hiddenNetwork } from '../../support/factories/hiddenNetwork.utils';
import { planOnlyNetwork } from '../../support/factories/planOnlyNetwork.utils';
import { tinyNetwork } from '../../support/factories/tinyNetwork.utils';

/**
 * The network with C closed for a spell on both its city line and the rail network's.
 *
 * @param network - The network.
 * @returns It, C's spells set.
 */
const withSpells = (network: ReturnType<typeof hiddenNetwork>) => {
  network.stations[stationId('c')] = {
    ...network.stations[stationId('c')]!,
    suspended: { [lineId('red')]: [{ from: '1930-01-01', until: '1931-01-01' }], [lineId('grey')]: [{ from: '1960-01-01', until: '1961-01-01' }] },
  };
  return network;
};

describe('NetworksUtils', () => {
  describe('isPlanOnly', () => {
    test('says a network with no track of its own but plans was never built', () => {
      expect(isPlanOnly(planOnlyNetwork())).toBe(true);
      expect(isPlanOnly(tinyNetwork())).toBe(false);
      expect(isPlanOnly({ ...tinyNetwork(), segments: [], plans: {} })).toBe(false);
      const { plans: _plans, ...withoutPlans } = tinyNetwork();
      expect(isPlanOnly({ ...withoutPlans, segments: [] })).toBe(false);
    });
  });

  describe('firstPlanOf', () => {
    test('takes the first of its plans, or none', () => {
      expect(firstPlanOf(planOnlyNetwork())).toBe('first');
      const { plans: _plans, ...withoutPlans } = tinyNetwork();
      expect(firstPlanOf(withoutPlans)).toBeUndefined();
    });
  });

  describe('withLinesHidden', () => {
    test('leaves a line hidden out as if it were not there: its own track and stations, its changes and plans, and a network with none left', () => {
      const shown = withLinesHidden(hiddenNetwork(), [lineId('grey')]).network;
      expect(keysOf(shown.networks)).toEqual(['metro']);
      expect(keysOf(shown.lines)).not.toContain('grey');
      expect(shown.segments.find(segment => segment.stationA === 'c' && segment.stationB === 'd')?.lines).not.toHaveProperty('grey');
      expect(shown.segments.some(segment => segment.stationB === 'x')).toBe(false);
      expect(shown.stations).not.toHaveProperty('x');
      expect(shown.stations[stationId('c')]?.infill).toEqual({ red: '1920-06-01', blue: '1960-06-01' });
      expect(withLinesHidden(withSpells(hiddenNetwork()), [lineId('grey')]).network.stations[stationId('c')]?.suspended).toEqual({
        red: [{ from: '1930-01-01', until: '1931-01-01' }],
      });
      expect(shown.transfers?.some(transfer => transfer.stationB === 'x')).toBe(false);
      expect(keysOf(shown.plans ?? {})).toEqual(['extension']);
    });

    test("keeps a segment's tracks to the lines left on it, saying none where they are left on one", () => {
      const tracksOf = (tracks: LineId[][]) => {
        const network = hiddenNetwork();
        network.segments.find(segment => segment.stationA === 'c' && segment.stationB === 'd')!.tracks = tracks;
        return withLinesHidden(network, [lineId('grey')]).network.segments.find(segment => segment.stationA === 'c' && segment.stationB === 'd');
      };
      expect(tracksOf([[lineId('red'), lineId('green')], [lineId('grey')]])).not.toHaveProperty('tracks');
      expect(tracksOf([[lineId('red')], [lineId('green')], [lineId('grey')]])?.tracks).toEqual([['red'], ['green']]);
    });

    test('takes the years another line was drawn as one hidden with it: its gaps, which the engine cuts its runs at', () => {
      const { network: shown, gaps } = withLinesHidden(tinyNetwork(), [lineId('red')]);
      expect(shown.lines).not.toHaveProperty('red');
      expect(shown.segments.some(segment => 'red' in segment.lines)).toBe(false);
      expect(shown.stations[stationId('c')]?.infill).toEqual({ blue: '1960-06-01' });
      // Pink, drawn as red until 1990, is out until then.
      expect(shown.lines[lineId('pink')]?.aliases).toBeUndefined();
      expect(gaps).toEqual(new Map([['pink', [{ from: -Infinity, until: toTimestamp('1990-01-01') }]]]));
      expect(shown.plans).toEqual({});
      expect(keysOf(withLinesHidden(tinyNetwork(), [lineId('red'), lineId('pink')]).network.lines)).toEqual(['blue', 'green']);
    });

    test('drops a run all inside a gap', () => {
      const network = tinyNetwork();
      network.segments[0]!.lines[lineId('pink')] = { open: '1900-01-01', close: '1950-01-01' };
      expect(withLinesHidden(network, [lineId('red')]).network.segments.some(segment => 'pink' in segment.lines)).toBe(false);
    });

    test('keeps a pseudo line while a line shown is drawn as it', () => {
      const network = tinyNetwork();
      network.lines[lineId('rede')] = { name: 'Rede', network: networkId('metro'), mode: 'metro', color: '#000000', pseudo: true };
      network.lines[lineId('blue')] = {
        ...network.lines[lineId('blue')]!,
        aliases: [{ until: '1935-01-01', as: lineId('rede'), text: 'Blue becomes its own line' }],
      };
      expect(withLinesHidden(network, [lineId('red')]).network.lines[lineId('rede')]).toEqual(network.lines[lineId('rede')]);
      expect(withLinesHidden(network, [lineId('blue')]).network.lines).not.toHaveProperty('rede');
    });

    test('keeps a plan with its sections on lines still drawn, and its stations only those reach', () => {
      const network = tinyNetwork();
      network.plans![planId('extension')]!.stations![stationId('g')] = { name: 'G', coordinate: [0.0144, 51.51] };
      network.plans![planId('extension')]!.sections.push({ line: lineId('blue'), stations: [stationId('b'), stationId('g')] });
      network.plans![planId('extension')]!.transfers = [
        { stationA: stationId('g'), stationB: stationId('a') },
        { stationA: stationId('e'), stationB: stationId('a') },
      ];
      const plan = withLinesHidden(network, [lineId('red')]).network.plans?.[planId('extension')];
      expect(plan?.sections).toEqual([{ line: 'blue', stations: ['b', 'g'] }]);
      expect(keysOf(plan?.stations ?? {})).toEqual(['g']);
      expect(plan?.transfers).toEqual([{ stationA: 'g', stationB: 'a' }]);
      expect(withLinesHidden(network, [lineId('red'), lineId('blue')]).network.plans).toEqual({});
    });

    test("makes a station only it served the plan's own where a plan builds on it, its place and name alone", () => {
      const network = hiddenNetwork();
      network.stations[stationId('x')] = { ...network.stations[stationId('x')]!, formerNames: [{ name: 'Old X', until: '1960-01-01' }] };
      network.plans![planId('extension')]!.sections.push({ line: lineId('red'), stations: [stationId('e'), stationId('x')] });
      const shown = withLinesHidden(network, [lineId('grey')]).network;
      expect(shown.stations).not.toHaveProperty('x');
      expect(shown.plans?.[planId('extension')]?.stations?.[stationId('x')]).toEqual({ name: 'X', coordinate: [0.0576, 51.5] });
    });

    test("makes track only it had the plan's own where a section links its stations, unless the plan says where it runs", () => {
      const network = hiddenNetwork();
      network.plans![planId('extension')]!.sections.push({ line: lineId('red'), stations: [stationId('d'), stationId('x')] });
      const shown = withLinesHidden(network, [lineId('grey')]).network;
      expect(shown.segments.some(segment => segment.stationB === 'x')).toBe(false);
      expect(shown.plans?.[planId('extension')]?.track).toEqual([
        {
          stationA: 'd',
          stationB: 'x',
          coordinates: [
            [0.0432, 51.5],
            [0.0576, 51.5],
          ],
        },
      ]);
      const given = {
        stationA: stationId('x'),
        stationB: stationId('d'),
        coordinates: [
          [0.0576, 51.5],
          [0.05, 51.49],
          [0.0432, 51.5],
        ] as [number, number][],
      };
      network.plans![planId('extension')]!.track = [given];
      expect(withLinesHidden(network, [lineId('grey')]).network.plans?.[planId('extension')]?.track).toEqual([given]);
    });

    test("starts the timeline at an older network while one of its lines shows, and at the city's own with them hidden", () => {
      const network = hiddenNetwork();
      network.networks[networkId('rail')] = { ...network.networks[networkId('rail')]!, start: '1850-01-01' };
      expect(withLinesHidden(network, []).network.meta.start).toBe('1850-01-01');
      expect(withLinesHidden(network, [lineId('grey')]).network.meta.start).toBe('1899-01-01');
      expect(network.meta.start).toBe('1899-01-01');
    });

    test('keeps the network as it is with nothing hidden', () => {
      const network = hiddenNetwork();
      expect(withLinesHidden(network, [])).toEqual({ network, gaps: new Map() });
      expect(withLinesHidden(network, []).network).toBe(network);
    });
  });

  describe('linesNamed', () => {
    test('takes a line by its id and every line of a network by its, but pseudo lines and ids it does not have', () => {
      const network = hiddenNetwork();
      network.lines[lineId('ghost')] = { name: 'Ghost', network: networkId('rail'), mode: 'suburban-rail', color: '#000000', pseudo: true };
      expect(linesNamed(network, ['nowhere', 'rail', 'blue'])).toEqual(['blue', 'grey']);
    });
  });

  describe('linesHiddenAtFirst', () => {
    test('gives the lines of the networks hidden at first, and none for a city that has none', () => {
      expect(linesHiddenAtFirst(hiddenNetwork())).toEqual(['grey']);
      expect(linesHiddenAtFirst(tinyNetwork())).toEqual([]);
    });
  });

  describe('networkChoicesOf', () => {
    test('lists each network with its lines, in both themes, and whether each shows', () => {
      const [metro, rail] = networkChoicesOf(hiddenNetwork(), [lineId('grey'), lineId('blue')]);
      expect(metro?.lines.map(line => [line.id, line.shown])).toEqual([
        ['red', true],
        ['blue', false],
        ['pink', true],
        ['green', true],
      ]);
      expect(rail).toEqual({ id: 'rail', name: 'Rail', lines: [{ id: 'grey', name: 'Grey', color: { light: '#888888', dark: '#bbbbbb' }, shown: false }] });
    });
  });
});
