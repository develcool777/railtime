import type { Theme } from '@railtime/network/facts.types';
import { BasemapStill } from '@railtime/renderer/basemapStill.service';
import type { PreviewWindow } from './preview.types.ts';

// The page Chrome draws previews in, bundled by esbuild (`PreviewRenderer`): one `BasemapStill` per
// theme, and `window.takePreview` to take a picture with one. This file runs in the browser, never
// under Node: nothing of the command is imported at run time.

/** Where the page's server has MapLibre's worker, beside the page. */
const WORKER_URL = new URL('/worker.mjs', location.href).href;

/** A still for each theme asked for, made the first time. */
const stills = new Map<Theme, BasemapStill>();

(window as PreviewWindow).takePreview = (theme, request) => {
  const still = stills.get(theme) ?? new BasemapStill({ theme, workerUrl: WORKER_URL });
  stills.set(theme, still);
  return still.take(request);
};
