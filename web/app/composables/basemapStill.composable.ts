import { useColorMode } from '#imports';
import { BasemapStill } from '@railtime/renderer/basemapStill.service';
import type { StillRequest } from '@railtime/renderer/basemapStill.types';
import type { Theme } from '@railtime/renderer/transitMap.types';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';

import type { BasemapStillBinding } from './basemapStill.composable.types';

/** The one hidden basemap every preview on the page is taken from, made on first use. */
let still: BasemapStill | null = null;
/** The theme it is coloured in. */
let stillTheme: Theme | null = null;
/** Stills taken already, by theme and request: a page visited again shows them at once. */
const taken = new Map<string, Promise<string>>();

/**
 * Pictures of the basemap for previews, in the site's colour mode, all from one hidden map.
 * Client only.
 *
 * @returns A way to take one.
 */
export const useBasemapStill = (): BasemapStillBinding => {
  const colorMode = useColorMode();

  const take = (request: StillRequest): Promise<string> => {
    const theme: Theme = colorMode.value === 'light' ? 'light' : 'dark';
    const key = `${theme}|${JSON.stringify(request)}`;
    const cached = taken.get(key);
    if (cached) return cached;
    still ??= new BasemapStill({ theme, workerUrl });
    if (stillTheme !== theme) still.setTheme(theme);
    stillTheme = theme;
    const picture = still.take(request);
    taken.set(key, picture);
    // A failed still is tried again next time.
    picture.catch(() => taken.delete(key));
    return picture;
  };

  return { take, theme: () => (colorMode.value === 'light' ? 'light' : 'dark') };
};
