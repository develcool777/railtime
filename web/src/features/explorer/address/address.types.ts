import type { CoverageDistance, Playhead } from '@railtime/network/facts.types';
import type { MapView, ViewMode } from '@railtime/renderer/transitMap.types';

import type { Section } from '~/features/explorer/explorer.types';

/**
 * A playhead as an address holds it, `at=202.4` or `at=202,1928-06-01`: its time only where its cursor
 * and progress do not imply it (the last change done's date, or the next one's while it is drawn), and
 * then to the day.
 */
export type LinkedPlayhead = Omit<Playhead, 'time'> & { time?: number };

/** What an explorer address holds: each part only when it is not the default. */
export type ExplorerUrlState = {
  /** Where in the network's history the map is; today, or with a plan the plan built, without one. */
  at?: LinkedPlayhead;
  /** Where the map looks; the whole network without one. */
  view?: MapView;
  /** The station whose panel is open. */
  station?: string;
  /** The plan shown on top of the network; none without one. */
  plan?: string;
  /** The panel's section open; the one the page opens on without one. */
  section?: Section;
  /** How far from a station coverage counts; the default distance without one. */
  walk?: CoverageDistance;
  /** The line whose view is open, or under the station's; none without one. */
  line?: string;
  /** In 3D; flat without one. */
  viewMode?: ViewMode;
  /** Station names hidden; shown without one. */
  stationNames?: false;
  /** The basemap's street and place names hidden; shown without one. */
  streetNames?: false;
  /** Only the map; the page around it without one. */
  mapOnly?: true;
};

/** An address's query, as the router gives it and takes it. */
export type ExplorerQuery = Record<string, string | null | (string | null)[] | undefined>;
