import { fileURLToPath } from 'node:url';
import type { Recording } from './recorder.types.ts';

/** A recording's settings where none are given: the video page, 1080p at 60 frames a second, from the app as it is served in development. */
export const RECORDING_DEFAULTS: Omit<Recording, 'city' | 'out'> = {
  page: 'video',
  rehearse: true,
  fps: 60,
  width: 1920,
  height: 1080,
  seconds: 600,
  origin: 'http://localhost:5180',
  query: '',
};

/** The package's own folder, whatever folder the command is run from. */
const PACKAGE_FOLDER = fileURLToPath(new URL('../../', import.meta.url));

/**
 * Chrome's own profile for recording, in the package's `.cache/`: its cache keeps the map's tiles
 * between recordings (served to be kept a day), so a city recorded again fetches none it has.
 */
export const BROWSER_PROFILE = `${PACKAGE_FOLDER}.cache/chrome`;

/** Where a video goes where the command names no file: `videos/<city>.mp4`, in the package. */
export const VIDEOS_FOLDER = `${PACKAGE_FOLDER}videos`;

/** Virtual seconds the page runs before playback starts: its map drawn, the camera settled. */
export const WARM_UP_SECONDS = 2;

/** Real milliseconds between looks at whether a frame is drawn. */
export const DRAWN_POLL_MS = 16;

/** The longest one frame waits to be drawn, real milliseconds: a tile that never comes is drawn without. */
export const DRAWN_TIMEOUT_MS = 15_000;

/** How long the page may take to open, real milliseconds. */
export const OPEN_TIMEOUT_MS = 60_000;

/** Where ffmpeg is installed, looked for in this order: Homebrew's, on Apple silicon and on Intel; the system's. */
export const FFMPEG_LOCATIONS = ['/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg', '/usr/bin/ffmpeg'];

/** A frame's JPEG quality: high enough that the encoder, not the frame, decides what is lost. */
export const FRAME_QUALITY = 95;
