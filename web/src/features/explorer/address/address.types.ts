import type { MapView, ViewMode } from '@railtime/renderer/transitMap.types';

import type { Section } from '~/features/explorer/explorer.types';

/** What an explorer address holds: each part only when it is not the default. */
export type ExplorerUrlState = {
  /** The day shown; today without one. */
  date?: number;
  /** Where the map looks; the whole network without one. */
  view?: MapView;
  /** The station whose panel is open. */
  station?: string;
  /** The plan shown on top of the network; none without one. */
  plan?: string;
  /** The panel's section open; the one the page opens on without one. */
  section?: Section;
  /** The line whose view is open, or under the station's; none without one. */
  line?: string;
  /** In 3D; flat without one. */
  viewMode?: ViewMode;
  /** Station names hidden; shown without one. */
  stationNames?: false;
  /** Only the map; the page around it without one. */
  mapOnly?: true;
};

/** An address's query, as the router gives it and takes it. */
export type ExplorerQuery = Record<string, string | null | (string | null)[] | undefined>;
