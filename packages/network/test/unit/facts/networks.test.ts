import { describe, expect, test } from 'vitest';
import { linesHiddenAtFirst, linesNamed, networkChoicesOf, withLinesHidden } from '../../../src/facts/networks.utils';
import { hiddenNetwork } from '../../support/factories/hiddenNetwork.utils';
import { tinyNetwork } from '../../support/factories/tinyNetwork.utils';

/**
 * The network with C closed for a spell on both its city line and the rail network's.
 *
 * @param network - The network.
 * @returns It, C's spells set.
 */
const withSpells = (network: ReturnType<typeof hiddenNetwork>) => {
  network.stations.c = {
    ...network.stations.c!,
    suspended: { red: [{ from: '1930-01-01', until: '1931-01-01' }], grey: [{ from: '1960-01-01', until: '1961-01-01' }] },
  };
  return network;
};

describe('NetworksUtils', () => {
  describe('withLinesHidden', () => {
    test('leaves a line hidden out as if it were not there: its own track and stations, its changes and plans, and a network with none left', () => {
      const shown = withLinesHidden(hiddenNetwork(), ['grey']);
      expect(Object.keys(shown.networks)).toEqual(['metro']);
      expect(Object.keys(shown.lines)).not.toContain('grey');
      expect(shown.segments.find(segment => segment.stationA === 'c' && segment.stationB === 'd')?.lines).not.toHaveProperty('grey');
      expect(shown.segments.some(segment => segment.stationB === 'x')).toBe(false);
      expect(shown.stations).not.toHaveProperty('x');
      expect(shown.stations.c?.infill).toEqual({ red: '1920-06-01', blue: '1960-06-01' });
      expect(withLinesHidden(withSpells(hiddenNetwork()), ['grey']).stations.c?.suspended).toEqual({ red: [{ from: '1930-01-01', until: '1931-01-01' }] });
      expect(shown.transfers?.some(transfer => transfer.stationB === 'x')).toBe(false);
      expect(Object.keys(shown.plans ?? {})).toEqual(['extension']);
    });

    test('takes the years another line was drawn as one hidden with it, that line drawn only once it is its own', () => {
      const shown = withLinesHidden(tinyNetwork(), ['red']);
      expect(shown.lines).not.toHaveProperty('red');
      expect(shown.segments.some(segment => 'red' in segment.lines)).toBe(false);
      expect(shown.stations.c?.infill).toEqual({ blue: '1960-06-01' });
      // Pink, drawn as red until 1990, runs A – B from then, as itself.
      expect(shown.lines.pink?.aliases).toBeUndefined();
      expect(shown.segments.find(segment => segment.stationA === 'a')?.lines).toEqual({ pink: { open: '1990-01-01' } });
      expect(shown.plans).toEqual({});
      expect(Object.keys(withLinesHidden(tinyNetwork(), ['red', 'pink']).lines)).toEqual(['blue', 'green']);
    });

    test('keeps a pseudo line while a line shown is drawn as it', () => {
      const network = tinyNetwork();
      network.lines.rede = { name: 'Rede', network: 'metro', mode: 'metro', color: '#000000', pseudo: true };
      network.lines.blue = { ...network.lines.blue!, aliases: [{ until: '1935-01-01', as: 'rede', text: 'Blue becomes its own line' }] };
      expect(withLinesHidden(network, ['red']).lines.rede).toEqual(network.lines.rede);
      expect(withLinesHidden(network, ['blue']).lines).not.toHaveProperty('rede');
    });

    test('keeps a plan with its sections on lines still drawn, and its stations only those reach', () => {
      const network = tinyNetwork();
      network.plans!.extension!.stations = { ...network.plans!.extension!.stations, g: { name: 'G', coordinate: [0.0144, 51.51] } };
      network.plans!.extension!.sections.push({ line: 'blue', stations: ['b', 'g'] });
      network.plans!.extension!.transfers = [
        { stationA: 'g', stationB: 'a' },
        { stationA: 'e', stationB: 'a' },
      ];
      const plan = withLinesHidden(network, ['red']).plans?.extension;
      expect(plan?.sections).toEqual([{ line: 'blue', stations: ['b', 'g'] }]);
      expect(Object.keys(plan?.stations ?? {})).toEqual(['g']);
      expect(plan?.transfers).toEqual([{ stationA: 'g', stationB: 'a' }]);
      expect(withLinesHidden(network, ['red', 'blue']).plans).toEqual({});
    });

    test("makes a station only it served the plan's own where a plan builds on it, its place and name alone", () => {
      const network = hiddenNetwork();
      network.stations.x = { ...network.stations.x!, formerNames: [{ name: 'Old X', until: '1960-01-01' }] };
      network.plans!.extension!.sections.push({ line: 'red', stations: ['e', 'x'] });
      const shown = withLinesHidden(network, ['grey']);
      expect(shown.stations).not.toHaveProperty('x');
      expect(shown.plans?.extension?.stations?.x).toEqual({ name: 'X', coordinate: [0.0576, 51.5] });
    });

    test("starts the timeline at an older network while one of its lines shows, and at the city's own with them hidden", () => {
      const network = hiddenNetwork();
      network.networks.rail = { ...network.networks.rail!, start: '1850-01-01' };
      expect(withLinesHidden(network, []).meta.start).toBe('1850-01-01');
      expect(withLinesHidden(network, ['grey']).meta.start).toBe('1899-01-01');
      expect(network.meta.start).toBe('1899-01-01');
    });

    test('keeps the network as it is with nothing hidden', () => {
      const network = hiddenNetwork();
      expect(withLinesHidden(network, [])).toBe(network);
    });
  });

  describe('linesNamed', () => {
    test('takes a line by its id and every line of a network by its, but pseudo lines and ids it does not have', () => {
      const network = hiddenNetwork();
      network.lines.ghost = { name: 'Ghost', network: 'rail', mode: 'suburban-rail', color: '#000000', pseudo: true };
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
      const [metro, rail] = networkChoicesOf(hiddenNetwork(), ['grey', 'blue']);
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
