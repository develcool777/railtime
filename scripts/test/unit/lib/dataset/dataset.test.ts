import { parseNetwork } from '@railtime/schema/network.schema';
import { globSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { formatNetwork } from '../../../../lib/dataset/dataset.utils.ts';

/** The repo's `data/` folder, where each city keeps its dataset. */
const DATA = fileURLToPath(new URL('../../../../../data/', import.meta.url));

/** Every city's dataset, `<city>/<city>.json`, relative to `data/`. */
const DATASETS = globSync('*/*.json', { cwd: DATA }).filter(path => path === `${path.split('/')[0]}/${path.split('/')[0]}.json`);

describe('DatasetUtils', () => {
  describe('formatNetwork', () => {
    test('finds the datasets', () => {
      expect(DATASETS).toContain('london/london.json');
    });

    test.each(DATASETS)('%s is a valid network, kept in its layout (pnpm data:format <city>)', path => {
      const text = readFileSync(`${DATA}${path}`, 'utf8');
      expect(formatNetwork(parseNetwork(JSON.parse(text)))).toBe(text);
    });
  });
});
