import type { Theme } from '@railtime/network/facts.types';
import type { StillRequest } from '@railtime/renderer/basemapStill.types';
import type { Browser } from 'playwright-core';
import type { Report } from '../city.types.ts';

/** A preview's size, in CSS pixels. */
export type PreviewSize = { width: number; height: number };

/** The preview page's window: what it offers the script driving it. */
export type PreviewWindow = Window & { takePreview?: (theme: Theme, request: StillRequest) => Promise<string> };

/** What the preview page's server serves, by path. */
export type Served = Record<string, { type: string; body: string }>;

/** What a `PreviewRenderer` is made with. */
export type PreviewOptions = {
  /** What it says as it goes: each picture written, and what goes wrong in the page. */
  report: Report;
  /** Starts the browser the pictures are drawn in: the Chrome installed on this machine, unless a test gives a stand-in. */
  launch?: () => Promise<Browser>;
};
