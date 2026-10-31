import { writeSummaries } from './summary.utils.ts';

try {
  writeSummaries();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
