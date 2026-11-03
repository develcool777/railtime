import { describe, expect, test } from 'vitest';
import { cities, citiesNamed } from '../../src/city.utils.ts';

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
});
