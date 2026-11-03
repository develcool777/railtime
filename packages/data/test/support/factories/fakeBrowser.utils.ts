import type { Theme } from '@railtime/network/facts.types';
import type { StillRequest } from '@railtime/renderer/basemapStill.types';
import type { Browser } from 'playwright-core';
import type { FakeBrowser } from '../fakeBrowser.types.ts';

/** What the stand-in page fetches from the local server as it opens: the page, its script and MapLibre's worker. */
const PAGE_PATHS = ['/', '/preview.js', '/worker.mjs', '/nothing'];

/**
 * A stand-in for Chrome, so `PreviewRenderer` runs in node: its one page opens the local server's page
 * for real (fetching what it serves) and answers each picture asked for with what `picture` gives.
 *
 * @param picture - The picture, as a data URL, for a theme and request; it may throw, as a page that fails.
 * @returns The stand-in and what it keeps.
 */
export const fakeBrowser = (picture: (theme: Theme, request: StillRequest) => string): FakeBrowser => {
  const drawn: FakeBrowser['drawn'] = [];
  const served: FakeBrowser['served'] = new Map();
  const listeners = new Map<string, (payload: unknown) => void>();
  const life = { closed: false };
  const page = {
    setDefaultTimeout: () => undefined,
    on: (event: string, listener: (payload: unknown) => void) => listeners.set(event, listener),
    goto: async (url: string) => {
      for (const path of PAGE_PATHS) {
        const response = await fetch(new URL(path, url));
        served.set(path, { status: response.status, body: await response.text() });
      }
    },
    waitForFunction: async () => undefined,
    evaluate: async (_draw: unknown, [theme, request]: [Theme, StillRequest]) => {
      drawn.push({ theme, request });
      return picture(theme, request);
    },
  };
  const browser = {
    newPage: async () => page,
    close: async () => {
      life.closed = true;
    },
  };
  return {
    launch: async () => browser as unknown as Browser,
    drawn,
    served,
    say: (event, payload) => listeners.get(event)?.(payload),
    isClosed: () => life.closed,
  };
};
