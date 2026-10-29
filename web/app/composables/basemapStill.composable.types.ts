import type { StillRequest } from '@railtime/renderer/basemapStill.types';
import type { Theme } from '@railtime/renderer/transitMap.types';

/** What `useBasemapStill` gives a preview. */
export type BasemapStillBinding = {
  /** A picture of the basemap, as a data URL, once its tiles are in. */
  take: (request: StillRequest) => Promise<string>;
  /** The theme stills are taken in now. */
  theme: () => Theme;
};
