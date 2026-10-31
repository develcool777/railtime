import { boundaryArgsOf, fetchBoundaries } from './boundary.utils.ts';

try {
  const { city, relation } = boundaryArgsOf(process.argv.slice(2));
  await fetchBoundaries(city, relation);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
