import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { onTestFinished } from 'vitest';
import { required } from '@railtime/core/required.utils';
import { citiesNamed } from '../../src/city.utils.ts';
import type { City } from '../../src/city.types.ts';

/**
 * A folder of the test's own, removed once it has finished: what a command writes goes there, never
 * into a city's files.
 *
 * @returns Its path.
 */
export const folderApart = (): string => {
  const folder = mkdtempSync(join(tmpdir(), 'railtime-'));
  onTestFinished(() => rmSync(folder, { recursive: true }));
  return folder;
};

/**
 * A city moved into a folder of the test's own: its network copied there, its outline (none yet) and
 * every picture written beside it there.
 *
 * @param id - The city's id.
 * @returns The city, as found in its folder apart.
 */
export const cityApart = (id: string): City => {
  const city = required(citiesNamed(id)[0], `city ${id}`);
  const folder = folderApart();
  const networkPath = join(folder, `${id}.json`);
  copyFileSync(city.networkPath, networkPath);
  return { ...city, networkPath, boundaryPath: join(folder, `${id}.boundary.json`) };
};
