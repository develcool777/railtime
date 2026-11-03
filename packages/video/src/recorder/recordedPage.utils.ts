import type { Page } from 'playwright-core';
import { PAUSE_BUTTON, PLAY_BUTTON, TAIL_SECONDS } from './recorder.constants.ts';
import type { RecordedPage, RecordedPageKind } from './recorder.types.ts';
import type { RecordedWindow, VideoPageState } from './videoPage.types.ts';

/**
 * Where the video page is, as its handle says (`VideoPageHandle`).
 *
 * @param page - The page.
 * @returns Where it is, or `null` before it has a handle.
 */
const videoStateOf = (page: Page): Promise<VideoPageState | null> => page.evaluate(() => (window as RecordedWindow).railtimeVideo?.state() ?? null);

/**
 * The video page, `/video/<city>`: made to be recorded. It says on its `window` when it is ready and
 * when it is over (`VideoPageHandle`), and starts when told; its end card is its ending.
 */
const VIDEO_PAGE: RecordedPage = {
  pathOf: city => `/video/${encodeURIComponent(city)}`,
  ready: async page => (await videoStateOf(page)) === 'ready',
  start: async page => {
    await page.evaluate(() => (window as RecordedWindow).railtimeVideo?.start());
  },
  ended: async page => (await videoStateOf(page)) === 'done',
  tailSeconds: 0,
};

/**
 * The explorer, `/<city>`, as anyone sees it: ready when its play button shows, started by its key,
 * over when its pause button goes; then a few seconds more, the camera's move to the whole network.
 */
const EXPLORER_PAGE: RecordedPage = {
  pathOf: city => `/${encodeURIComponent(city)}`,
  ready: async page => (await page.locator(PLAY_BUTTON).count()) > 0,
  start: page => page.keyboard.press('Space'),
  ended: async page => (await page.locator(PAUSE_BUTTON).count()) === 0,
  tailSeconds: TAIL_SECONDS,
};

/**
 * How to record a kind of page.
 *
 * @param kind - The video page, or the explorer.
 * @returns How it is opened, started and known to be over.
 */
export const recordedPageOf = (kind: RecordedPageKind): RecordedPage => (kind === 'video' ? VIDEO_PAGE : EXPLORER_PAGE);
