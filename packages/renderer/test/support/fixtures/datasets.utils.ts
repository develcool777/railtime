import type { Network } from '@railtime/schema/network.types';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * A city's dataset, the source of truth the app serves: for tests that check its history plays as
 * it should.
 *
 * @param city - The city's folder in `data/`.
 * @returns The network.
 */
export const cityNetwork = (city: string): Network =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`../../../../../data/${city}/${city}.json`, import.meta.url)), 'utf8'));

/**
 * The real London network.
 *
 * @returns The network.
 */
export const londonNetwork = (): Network => cityNetwork('london');
