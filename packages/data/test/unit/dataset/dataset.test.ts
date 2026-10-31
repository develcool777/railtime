import { parseBoundary } from '@railtime/schema/boundary.schema';
import { parseNetwork } from '@railtime/schema/network.schema';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { boundaryPathOf, datasets } from '../../../src/dataset/city.utils.ts';
import { formatNetwork } from '../../../src/dataset/dataset.utils.ts';
import { holds } from '../../support/boundary.utils.ts';

/** Every city's dataset, `cities/<country>/<city>/<city>.json`. */
const DATASETS = datasets().map(({ country, city, path }) => ({ name: `${country}/${city}`, path }));

/** Every city with an outline, `cities/<country>/<city>/<city>.boundary.json`. */
const BOUNDED = datasets()
  .filter(dataset => existsSync(boundaryPathOf(dataset)))
  .map(dataset => ({ name: `${dataset.country}/${dataset.city}`, path: dataset.path, boundaryPath: boundaryPathOf(dataset) }));

describe('DatasetUtils', () => {
  describe('formatNetwork', () => {
    test('finds the datasets', () => {
      expect(DATASETS.map(dataset => dataset.name)).toContain('united-kingdom/london');
    });

    test.each(DATASETS)('$name is a valid network, kept in its layout (pnpm data:format <city>)', ({ path }) => {
      const text = readFileSync(path, 'utf8');
      expect(formatNetwork(parseNetwork(JSON.parse(text)))).toBe(text);
    });
  });

  describe('boundaries', () => {
    test('finds an outline for every city', () => {
      expect(BOUNDED.map(dataset => dataset.name)).toEqual(DATASETS.map(dataset => dataset.name));
    });

    test.each(BOUNDED)("$name's outline is valid, and holds most of its stations: it is its own city's", ({ path, boundaryPath }) => {
      const boundary = parseBoundary(JSON.parse(readFileSync(boundaryPath, 'utf8')));
      const network = parseNetwork(JSON.parse(readFileSync(path, 'utf8')));
      const built = Object.values(network.stations);
      // A city with nothing built yet is placed by its plans.
      const stations = built.length > 0 ? built : Object.values(network.plans ?? {}).flatMap(plan => Object.values(plan.stations ?? {}));
      // A network or a plan can run out past its city's limits (London's Metropolitan to Amersham, Bristol's
      // mass transit to its airport), but not mostly: another city's outline would hold none.
      expect(stations.filter(station => holds(boundary, station.coordinate)).length / stations.length).toBeGreaterThan(0.5);
    });
  });
});
