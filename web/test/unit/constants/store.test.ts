import { describe, expect, test } from 'vitest';
import { STORE_IDS } from '~/constants/store.constants';

/** Every store's source, read as text: a store module run would make its map, its network and the rest. */
const STORE_SOURCES = import.meta.glob<string>('../../../src/**/*.store.ts', { query: '?raw', import: 'default', eager: true });

/** The ids the stores are made with, by their names in `STORE_IDS`. */
const declaredIds = new Set(
  Object.values(STORE_SOURCES).flatMap(source => [...source.matchAll(/defineStore\(STORE_IDS\.([A-Z0-9_]+)/g)].map(match => match[1])),
);

describe('StoreConstants', () => {
  test('finds a store for every id', () => {
    expect(Object.keys(STORE_IDS).filter(key => !declaredIds.has(key))).toEqual([]);
  });

  test('finds every store made with its id from here, none written in place', () => {
    const inPlace = Object.entries(STORE_SOURCES).filter(([, source]) => /defineStore\(\s*['"`]/.test(source));
    expect(inPlace.map(([path]) => path)).toEqual([]);
  });

  test('gives no two stores one id', () => {
    const ids = Object.values(STORE_IDS);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
