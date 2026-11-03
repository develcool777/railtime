import type { Theme } from '@railtime/network/facts.types';
import type { StillRequest } from '@railtime/renderer/basemapStill.types';
import type { Browser } from 'playwright-core';

/** A stand-in for Chrome as Playwright drives it: it keeps what the preview page was asked to draw. */
export type FakeBrowser = {
  /** Starts it, as `PreviewRenderer` is given to. */
  launch: () => Promise<Browser>;
  /** Each picture asked for, in order: its theme and request. */
  drawn: { theme: Theme; request: StillRequest }[];
  /** What the page loaded from the local server, by path: the status and the body. */
  served: Map<string, { status: number; body: string }>;
  /** Says something in the page as Chrome would: `pageerror` with an error, `console` with a message. */
  say: (event: 'pageerror' | 'console', payload: unknown) => void;
  /** Whether it was closed. */
  isClosed: () => boolean;
};
