import { describe, expect, test } from 'vitest';
import { optionalNetworksAsked, optionalNetworksOf, withNetworksShown } from '../../../src/facts/networks.utils';
import { optionalNetwork } from '../../support/factories/optionalNetwork.utils';
import { tinyNetwork } from '../../support/factories/tinyNetwork.utils';

/**
 * The optional network with C closed for a spell on both its city line and the optional network's.
 *
 * @param network - The network.
 * @returns It, C's spells set.
 */
const withSpells = (network: ReturnType<typeof optionalNetwork>) => {
  network.stations.c = {
    ...network.stations.c!,
    suspended: { red: [{ from: '1930-01-01', until: '1931-01-01' }], grey: [{ from: '1960-01-01', until: '1961-01-01' }] },
  };
  return network;
};

describe('NetworksUtils', () => {
  describe('withNetworksShown', () => {
    test('leaves an optional network off as if it were not there: its lines, its own track and stations, its changes and plans', () => {
      const shown = withNetworksShown(optionalNetwork(), []);
      expect(Object.keys(shown.networks)).toEqual(['metro']);
      expect(Object.keys(shown.lines)).not.toContain('grey');
      expect(shown.segments.find(segment => segment.stationA === 'c' && segment.stationB === 'd')?.lines).not.toHaveProperty('grey');
      expect(shown.segments.some(segment => segment.stationB === 'x')).toBe(false);
      expect(shown.stations).not.toHaveProperty('x');
      expect(shown.stations.c?.infill).toEqual({ red: '1920-06-01', blue: '1960-06-01' });
      expect(withNetworksShown(withSpells(optionalNetwork()), []).stations.c?.suspended).toEqual({ red: [{ from: '1930-01-01', until: '1931-01-01' }] });
      expect(shown.transfers?.some(transfer => transfer.stationB === 'x')).toBe(false);
      expect(Object.keys(shown.plans ?? {})).toEqual(['extension']);
    });

    test("makes a station only it served the plan's own where a plan builds on it, its place and name alone", () => {
      const network = optionalNetwork();
      network.stations.x = { ...network.stations.x!, formerNames: [{ name: 'Old X', until: '1960-01-01' }] };
      network.plans!.extension!.sections.push({ line: 'red', stations: ['e', 'x'] });
      const shown = withNetworksShown(network, []);
      expect(shown.stations).not.toHaveProperty('x');
      expect(shown.plans?.extension?.stations?.x).toEqual({ name: 'X', coordinate: [0.0576, 51.5] });
    });

    test("starts the timeline at an older network shown, and at the city's own with it off", () => {
      const network = optionalNetwork();
      network.networks.rail = { ...network.networks.rail!, start: '1850-01-01' };
      expect(withNetworksShown(network, ['rail']).meta.start).toBe('1850-01-01');
      expect(withNetworksShown(network, []).meta.start).toBe('1899-01-01');
      expect(network.meta.start).toBe('1899-01-01');
    });

    test('keeps one asked for whole, and a network with nothing optional as it is', () => {
      const network = optionalNetwork();
      expect(withNetworksShown(network, ['rail'])).toBe(network);
      const tiny = tinyNetwork();
      expect(withNetworksShown(tiny, [])).toBe(tiny);
    });
  });

  describe('optionalNetworksAsked', () => {
    test('keeps those the city has, in its order', () => {
      expect(optionalNetworksAsked(optionalNetwork(), ['nowhere', 'rail', 'metro'])).toEqual(['rail']);
    });
  });

  describe('optionalNetworksOf', () => {
    test('lists each with its lines, in both themes, and whether it shows', () => {
      expect(optionalNetworksOf(optionalNetwork(), [])).toEqual([
        { id: 'rail', name: 'Rail', shown: false, lines: [{ id: 'grey', name: 'Grey', color: { light: '#888888', dark: '#bbbbbb' } }] },
      ]);
      expect(optionalNetworksOf(optionalNetwork(), ['rail'])[0]?.shown).toBe(true);
    });
  });
});
