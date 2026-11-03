import { VideoRecorder } from './recorder.service.ts';
import { recordingOf } from './recorder.utils.ts';

try {
  await new VideoRecorder().record(recordingOf(process.argv.slice(2)));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
