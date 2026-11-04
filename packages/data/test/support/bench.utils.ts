import { parseBoundary } from '@railtime/schema/boundary.schema';
import type { CityBoundary } from '@railtime/schema/boundary.types';
import type { Network } from '@railtime/schema/network.types';
import { existsSync, readFileSync } from 'node:fs';
import type { TestContext } from 'vitest';
import { citiesNamed, readNetwork } from '../../src/city.utils';

/** Where each benchmark keeps its last run, in this package: `test-reports/` is never committed. */
const LAST_RUNS = 'test-reports/bench';

/** A city's network and outline, read once for a file's benchmarks. */
export type BenchCity = { network: Network; boundary: CityBoundary };

/**
 * A city's network and outline, as the app serves them.
 *
 * @param id - The city's id.
 * @returns Its network and outline.
 */
export const benchCity = (id: string): BenchCity => {
  const [city] = citiesNamed(id);
  if (!city) throw new Error(`No city ${id}`);
  return { network: readNetwork(city), boundary: parseBoundary(JSON.parse(readFileSync(city.boundaryPath, 'utf8'))) };
};

/**
 * Times a piece of work, and sets it beside its last run on this machine when there is one: run on
 * main, then on a branch, it says how much faster or slower the branch is. This run is kept for the next.
 *
 * @param bench - The test's `bench`.
 * @param name - What is timed, unique among the benchmarks: its last run is kept by it.
 * @param work - The work.
 */
export const benchAgainstLastRun = async (bench: TestContext['bench'], name: string, work: () => void): Promise<void> => {
  const kept = `${LAST_RUNS}/${name.replaceAll(/[^a-z0-9]+/gi, '-').toLowerCase()}.json`;
  const now = bench(name, { writeResult: kept }, work);
  if (existsSync(new URL(`../../${kept}`, import.meta.url))) await bench.compare(bench.from(`${name}, last run`, kept), now);
  else await now.run();
};
