import { boundaryArgsOf, fetchBoundaries } from './boundary.utils.ts';

try {
  const { city, relation } = boundaryArgsOf(process.argv.slice(2));
  await fetchBoundaries(city, relation, console.log);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  console.error('usage: pnpm data:boundary [city [relation]], where relation is an OpenStreetMap id');
  process.exitCode = 1;
}
