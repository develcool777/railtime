import { parseNetwork } from '@railtime/schema/network.schema';
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { datasets } from '../../../src/dataset/city.utils.ts';
import { formatNetwork } from '../../../src/dataset/dataset.utils.ts';

/** Every city's dataset, `cities/<country>/<city>/<city>.json`. */
const DATASETS = datasets().map(({ country, city, path }) => ({ name: `${country}/${city}`, path }));

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
});
