import { parseBoundary } from '@railtime/schema/boundary.schema';
import { parseNetwork } from '@railtime/schema/network.schema';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { boundaryPathOf, datasets } from '../../../src/dataset/city.utils.ts';
import { formatNetwork } from '../../../src/dataset/dataset.utils.ts';
import { MIN_STATIONS_HELD } from '../../../src/boundary/boundary.constants.ts';
import { formatBoundary, stationsHeld } from '../../../src/boundary/boundary.utils.ts';

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

    test.each(BOUNDED)("$name's outline is valid, kept in its layout, and holds most of its stations: it is its own city's", ({ path, boundaryPath }) => {
      const text = readFileSync(boundaryPath, 'utf8');
      const boundary = parseBoundary(JSON.parse(text));
      expect(formatBoundary(boundary)).toBe(text);
      expect(stationsHeld(boundary, parseNetwork(JSON.parse(readFileSync(path, 'utf8'))))).toBeGreaterThan(MIN_STATIONS_HELD);
    });
  });
});
