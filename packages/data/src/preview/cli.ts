import { PreviewRenderer } from './preview.service.ts';

try {
  await new PreviewRenderer().draw(process.argv[2]);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
