import { BasemapStill } from '@railtime/renderer/basemapStill.service';
import type { PreviewTheme, PreviewWindow } from './preview.types.ts';

/**
 * Readies the page Chrome draws previews in: one `BasemapStill` per theme, and `window.takePreview`
 * to take a picture with one. Runs in the browser, bundled by `PreviewRenderer`.
 *
 * @param workerUrl - Where MapLibre's worker script is served.
 */
export const installPreviewPage = (workerUrl: string): void => {
  const stills = new Map<PreviewTheme, BasemapStill>();
  (window as PreviewWindow).takePreview = (theme, request) => {
    const still = stills.get(theme) ?? new BasemapStill({ theme, workerUrl });
    stills.set(theme, still);
    return still.take(request);
  };
};
