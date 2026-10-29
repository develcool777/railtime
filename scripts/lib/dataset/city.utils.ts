import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Where a city's dataset is kept: its source of truth, which the app serves.
 *
 * @param city - The city's folder name.
 * @returns The path of `data/<city>/<city>.json`.
 */
export const datasetPath = (city: string): string => fileURLToPath(new URL(`../../../data/${city}/${city}.json`, import.meta.url));

/**
 * The city a command was run for: its first argument, which must name a folder in `data/` with a
 * dataset. Exits with the usage otherwise.
 *
 * @param command - The command's name, for the usage line (`format` for `pnpm data:format <city>`).
 * @returns The city's folder name.
 */
export const cityArgument = (command: string): string => {
  const city = process.argv[2];
  if (city && existsSync(datasetPath(city))) return city;
  console.error(`usage: pnpm data:${command} <city>, where data/<city>/<city>.json exists`);
  process.exit(1);
};
