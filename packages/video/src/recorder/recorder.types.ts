import type { Browser } from 'playwright-core';

/** What one video records: which page, how big, how smooth, for how long at most, and where it goes. */
export type Recording = {
  /** The city's page, by its id in the address (`kyiv`). */
  city: string;
  /** Frames a second. */
  fps: number;
  /** The video's size, in pixels. */
  width: number;
  height: number;
  /** The longest it runs, seconds: it ends with the playback before then. */
  seconds: number;
  /** Where the app is served. */
  origin: string;
  /** More of the page's address (`mapOnly=1&speed=2`), or empty. */
  query: string;
  /** The MP4 written. */
  out: string;
};

/** The clock a page under recording runs on: moved only by the recorder, a frame at a time. */
type RecorderClock = {
  /**
   * Moves the clock on and runs the frames the page asked for.
   *
   * @param milliseconds - How far; 0 runs them at the same time, for what arrived meanwhile.
   */
  advance: (milliseconds: number) => void;
};

/**
 * The page's globals the recording clock takes over: its time and its frames. A stand-in in tests;
 * the page's `window` when recording.
 */
export type RecordingScope = {
  performance: { now: () => number };
  Date: { now: () => number };
  requestAnimationFrame: (callback: (time: number) => void) => number;
  cancelAnimationFrame: (handle: number) => void;
  railtimeRecorder?: RecorderClock;
};

/** What a `VideoRecorder` is made with. */
export type RecorderOptions = {
  /** Starts the browser the page is recorded in: the Chrome installed on this machine, unless a test gives a stand-in. */
  launch?: () => Promise<Browser>;
};
