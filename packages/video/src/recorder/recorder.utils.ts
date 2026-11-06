import { join } from 'node:path';
import { parseArgs } from 'node:util';
import type { BrowserType } from 'playwright-core';
import { FFMPEG_LOCATIONS, RECORDING_DEFAULTS, VIDEOS_FOLDER } from './recorder.constants.ts';
import type { DrawnScope, RecordedPageKind, Recording, RecordingScope } from './recorder.types.ts';

/**
 * A whole number at least 1, from an argument.
 *
 * @param name - The argument's name, for the error.
 * @param text - What was given, or nothing for the default.
 * @param fallback - The default.
 * @returns The number.
 * @throws {Error} For anything else.
 */
const countOf = (name: string, text: string | undefined, fallback: number): number => {
  if (text === undefined) return fallback;
  const count = Number(text);
  if (!Number.isSafeInteger(count) || count < 1) throw new Error(`--${name} takes a whole number, not ${text}`);
  return count;
};

/**
 * Whether an argument names a kind of page.
 *
 * @param text - What was given.
 * @returns Whether it is `video` or `explorer`.
 */
const isPageKind = (text: string): text is RecordedPageKind => text === 'video' || text === 'explorer';

/**
 * Where the app is served, from an argument.
 *
 * @param text - What was given.
 * @returns Its origin (`http://localhost:5180`), whatever path followed it.
 * @throws {Error} For anything that is not an address.
 */
const originOf = (text: string): string => {
  try {
    return new URL(text).origin;
  } catch (error) {
    throw new Error(`--origin takes an address (http://localhost:5180), not ${text}`, { cause: error });
  }
};

/**
 * What the command's arguments ask to record.
 *
 * @param args - The arguments after the command: the city, then its options.
 * @returns The recording, its defaults filled in.
 * @throws {Error} For no city, an option it does not know, or a value it cannot read.
 */
export const recordingOf = (args: string[]): Recording => {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    allowNegative: true,
    options: {
      page: { type: 'string' },
      rehearse: { type: 'boolean' },
      fps: { type: 'string' },
      size: { type: 'string' },
      seconds: { type: 'string' },
      query: { type: 'string' },
      origin: { type: 'string' },
      out: { type: 'string' },
    },
  });
  const [city] = positionals;
  if (!city || positionals.length > 1) throw new Error('name one city');
  const size = /^(\d+)x(\d+)$/.exec(values.size ?? `${RECORDING_DEFAULTS.width}x${RECORDING_DEFAULTS.height}`);
  if (!size) throw new Error(`--size takes width x height (1920x1080), not ${values.size}`);
  const page = values.page ?? RECORDING_DEFAULTS.page;
  if (!isPageKind(page)) throw new Error(`--page takes video or explorer, not ${page}`);
  return {
    city,
    page,
    rehearse: values.rehearse ?? RECORDING_DEFAULTS.rehearse,
    fps: countOf('fps', values.fps, RECORDING_DEFAULTS.fps),
    width: countOf('size', size[1], RECORDING_DEFAULTS.width),
    height: countOf('size', size[2], RECORDING_DEFAULTS.height),
    seconds: countOf('seconds', values.seconds, RECORDING_DEFAULTS.seconds),
    origin: originOf(values.origin ?? RECORDING_DEFAULTS.origin),
    query: (values.query ?? RECORDING_DEFAULTS.query).replace(/^\?/, ''),
    out: values.out ?? join(VIDEOS_FOLDER, `${city}.mp4`),
  };
};

/**
 * The address of the page recorded.
 *
 * @param recording - The recording.
 * @returns The city's video page or explorer, with the query given.
 */
export const pageUrlOf = (recording: Recording): string => {
  const city = encodeURIComponent(recording.city);
  const url = new URL(recording.page === 'video' ? `/video/${city}` : `/${city}`, recording.origin);
  url.search = recording.query;
  return url.href;
};

/**
 * Where ffmpeg is: the first of the places it is installed to that has it.
 *
 * @param installed - Whether a file is there.
 * @returns Its path.
 * @throws {Error} For none, saying how to install it.
 */
export const ffmpegPathOf = (installed: (path: string) => boolean): string => {
  const found = FFMPEG_LOCATIONS.find(installed);
  if (!found) throw new Error(`no ffmpeg in ${FFMPEG_LOCATIONS.join(', ')}: install it (brew install ffmpeg)`);
  return found;
};

/**
 * How ffmpeg is called to make the video: JPEG frames on its input, one each frame, into an H.264
 * MP4 every player and YouTube take (4:2:0 colour, its index at the front), near lossless.
 *
 * @param recording - The recording.
 * @returns ffmpeg's arguments.
 */
export const ffmpegArgsOf = (recording: Recording): string[] => [
  '-y',
  '-loglevel',
  'error',
  '-f',
  'image2pipe',
  '-framerate',
  String(recording.fps),
  '-c:v',
  'mjpeg',
  '-i',
  '-',
  '-c:v',
  'libx264',
  '-preset',
  'medium',
  '-crf',
  '18',
  '-pix_fmt',
  'yuv420p',
  '-movflags',
  '+faststart',
  recording.out,
];

/**
 * Puts a page on a clock only the recorder moves: its time stands still, and the frames it asks for
 * wait, until `railtimeRecorder.advance` moves it on one frame and runs them. A frame can then take as
 * long as it needs to draw and be taken, and the video still plays at an even pace. It is run in the
 * page before any of its own scripts, so it uses nothing from outside itself.
 *
 * @param scope - The page's globals: its `window`.
 */
export const installRecordingClock = (scope: RecordingScope): void => {
  const started = scope.Date.now();
  let elapsed = 0;
  let nextHandle = 1;
  let waiting = new Map<number, (time: number) => void>();
  scope.performance.now = () => elapsed;
  scope.Date.now = () => started + elapsed;
  scope.requestAnimationFrame = callback => {
    const handle = nextHandle++;
    waiting.set(handle, callback);
    return handle;
  };
  scope.cancelAnimationFrame = handle => waiting.delete(handle);
  scope.railtimeRecorder = {
    advance: milliseconds => {
      elapsed += milliseconds;
      // Those asked for while these run wait for the next frame, as in a browser.
      const due = waiting;
      waiting = new Map();
      for (const callback of due.values()) callback(elapsed);
    },
  };
};

/**
 * Draws the page again at the moment it is held at, and says whether that is all of it: the frames it
 * asked for run first, as what came meanwhile is drawn by them or asks for more, and the question is
 * asked in the same turn, so nothing can land between the drawing and the answer. A page with no handle
 * yet has nothing to wait for. Run in the page, so it uses nothing from outside itself.
 *
 * @param scope - The page's globals: its `window`.
 * @returns Whether a frame can be taken.
 */
export const drawnOnceHeld = (scope: DrawnScope): boolean => {
  scope.railtimeRecorder?.advance(0);
  return scope.railtimeVideo?.drawn() ?? true;
};

/**
 * Waits for a frame to be drawn, or for as long as a frame may wait.
 *
 * @param drawn - Draws the frame again, saying whether it is whole.
 * @param wait - Waits a little.
 * @param timedOut - Whether the frame has waited as long as it may.
 */
export const untilDrawn = async (drawn: () => Promise<boolean>, wait: () => Promise<unknown>, timedOut: () => boolean): Promise<void> => {
  while (!(await drawn()) && !timedOut()) await wait();
};

/**
 * How Chrome is started for a recording: the one installed, at the video's size, a pixel to a pixel, and
 * asking for all the motion there is, whatever the machine's own setting: what rolls in the video
 * follows the preference (`CountingNumber`), and the recording says what it wants.
 *
 * @param recording - The recording.
 * @returns The options.
 */
export const launchOptionsOf = (recording: Recording): Parameters<BrowserType['launchPersistentContext']>[1] => ({
  channel: 'chrome',
  viewport: { width: recording.width, height: recording.height },
  deviceScaleFactor: 1,
  reducedMotion: 'no-preference',
});
