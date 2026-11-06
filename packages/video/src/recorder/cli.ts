import { VideoRecorder } from './recorder.service.ts';
import { recordingOf } from './recorder.utils.ts';

/** How the command is called. */
const USAGE =
  'usage: pnpm video:record <city> [--page video|explorer] [--no-rehearse] [--fps 60] [--size 1920x1080] [--seconds 600] [--query "mapOnly=1"] [--origin http://localhost:5180] [--out file.mp4]';

try {
  await new VideoRecorder({ report: console.log }).record(recordingOf(process.argv.slice(2)));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  console.error(USAGE);
  console.error('The app is served by pnpm dev.');
  process.exitCode = 1;
}
