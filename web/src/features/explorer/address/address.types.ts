import type { MapView } from '@railtime/renderer/transitMap.types';

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
};

/** An address's query, as the router gives it and takes it. */
export type ExplorerQuery = Record<string, string | null | (string | null)[] | undefined>;
