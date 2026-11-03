import type { Browser, Page } from 'playwright-core';
import type { RecordedWindow } from './videoPage.types.ts';

/** The page a video is made of: the one made for it, or the explorer as anyone sees it. */
export type RecordedPageKind = 'video' | 'explorer';

/** What one video records: which page, how big, how smooth, for how long at most, and where it goes. */
export type Recording = {
  /** The city, by its id in the address (`kyiv`). */
  city: string;
  /** Which of its pages. */
  page: RecordedPageKind;
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

/**
 * The page's globals the recording clock takes over: its time and its frames. A stand-in in tests;
 * the page's `window` when recording.
 */
export type RecordingScope = {
  performance: { now: () => number };
  Date: { now: () => number };
  requestAnimationFrame: (callback: (time: number) => void) => number;
  cancelAnimationFrame: (handle: number) => void;
} & Pick<RecordedWindow, 'railtimeRecorder'>;

/** What a `VideoRecorder` is made with. */
export type RecorderOptions = {
  /** Starts the browser the page is recorded in: the Chrome installed on this machine, unless a test gives a stand-in. */
  launch?: () => Promise<Browser>;
};

/** How a kind of page is recorded: where it is, when it is ready, how it starts, and when it is over. */
export type RecordedPage = {
  /**
   * Its path.
   *
   * @param city - The city.
   */
  pathOf: (city: string) => string;
  /** Whether it is ready to start: its map drawn. */
  ready: (page: Page) => Promise<boolean>;
  /** Starts it playing. */
  start: (page: Page) => Promise<void>;
  /** Whether it has played to its end. */
  ended: (page: Page) => Promise<boolean>;
  /** Seconds recorded after it ends. */
  tailSeconds: number;
};
