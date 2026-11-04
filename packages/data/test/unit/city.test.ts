import type { CityIndex } from '@railtime/schema/cityIndex.types';
import { globSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { cities, citiesNamed, SUMMARIES_PATH } from '../../src/city.utils.ts';

/** The repository's root. */
const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

describe('CityUtils', () => {
  describe('citiesNamed', () => {
    test('gives every city for none named', () => {
      expect(citiesNamed(undefined)).toEqual(cities());
    });

    test('gives the city named, where its files are', () => {
      expect(citiesNamed('kyiv')).toEqual([
        expect.objectContaining({ country: 'ukraine', id: 'kyiv', networkPath: expect.stringMatching(/\/cities\/ukraine\/kyiv\/kyiv\.json$/) }),
      ]);
    });

    test('gives none for a city it does not know', () => {
      expect(citiesNamed('atlantis')).toEqual([]);
    });
  });

  describe('SUMMARIES_PATH', () => {
    // The packages beneath the data know no city: they draw, play and answer for any network.
    test('names cities no package beneath the data names, in its code or its tests', () => {
      const summaries = JSON.parse(readFileSync(SUMMARIES_PATH, 'utf8')) as CityIndex;
      const names = Object.entries(summaries).flatMap(([id, entry]) => [id, entry.name]);
      const named = new RegExp(String.raw`\b(${names.map(name => RegExp.escape(name)).join('|')})\b`, 'i');
      const found = globSync('packages/{core,schema,network,renderer}/{src,test}/**/*.ts', { cwd: ROOT }).flatMap(path =>
        readFileSync(`${ROOT}${path}`, 'utf8')
          .split('\n')
          .flatMap((line, index) => (named.test(line) ? [`${path}:${index + 1}: ${line.trim()}`] : [])),
      );
      expect(found).toEqual([]);
    });
  });
});
