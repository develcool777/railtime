import { writeSummaries } from './summary.utils.ts';

try {
  writeSummaries(console.log);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
