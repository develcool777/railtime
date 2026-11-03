import type { Recording } from './recorder.types.ts';

/** How the command is called. */
export const RECORD_USAGE =
  'usage: pnpm video:record <city> [--fps 60] [--size 1920x1080] [--seconds 600] [--query "mapOnly=1"] [--origin http://localhost:5180] [--out file.mp4]';

/** A recording's settings where the command gives none: 1080p at 60 frames a second, from the app run by `pnpm dev`. */
export const RECORDING_DEFAULTS: Omit<Recording, 'city' | 'out'> = {
  fps: 60,
  width: 1920,
  height: 1080,
  seconds: 600,
  origin: 'http://localhost:5180',
  query: '',
};

/** Where a video goes where the command names no file: `videos/<city>.mp4`, beside the package's code. */
export const VIDEOS_FOLDER = 'videos';

/** Virtual seconds the page runs before playback starts: its map drawn, the camera settled. */
export const WARM_UP_SECONDS = 2;

/** Virtual seconds recorded after playback ends: the camera's move to the whole network. */
export const TAIL_SECONDS = 3;

/** Real milliseconds without a request, after the last, before a frame is taken: the tiles that came, drawn. */
export const QUIET_MS = 120;

/** Real milliseconds between looks at whether the page has settled. */
export const SETTLE_POLL_MS = 16;

/** The longest one frame waits for its tiles, real milliseconds: a tile that never comes is drawn without. */
export const SETTLE_TIMEOUT_MS = 15_000;

/** How long the page may take to open, real milliseconds. */
export const OPEN_TIMEOUT_MS = 60_000;

/** The play button: there once the page can play. */
export const PLAY_BUTTON = 'button[aria-label^="Play"]';

/** The pause button: there while it plays, gone when playback ends. */
export const PAUSE_BUTTON = 'button[aria-label="Pause"]';

/** Where ffmpeg is installed, looked for in this order: Homebrew's, on Apple silicon and on Intel; the system's. */
export const FFMPEG_LOCATIONS = ['/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg', '/usr/bin/ffmpeg'];

/** A frame's JPEG quality: high enough that the encoder, not the frame, decides what is lost. */
export const FRAME_QUALITY = 95;
