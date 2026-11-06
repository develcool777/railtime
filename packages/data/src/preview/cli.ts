import { PreviewRenderer } from './preview.service.ts';

try {
  await new PreviewRenderer({ report: console.log }).draw(process.argv[2]);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  console.error('usage: pnpm data:previews [city]');
  process.exitCode = 1;
}
