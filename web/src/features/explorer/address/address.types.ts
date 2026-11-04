import type { CoverageDistance, Playhead, Stop } from '@railtime/network/facts.types';
import type { CameraMode, MapView, ViewMode } from '@railtime/renderer/transitMap.types';
import type { LineId, PlanId, StationId } from '@railtime/schema/network.types';
import type { PlayerSettings, Section } from '~/features/explorer/explorer.types';
import type { RouteEnds } from '~/features/explorer/tools.types';

/**
 * A playhead as an address holds it, `at=202.4` or `at=202,1928-06-01`: its time only where its cursor
 * and progress do not imply it (the last change done's date, or the next one's while it is drawn), and
 * then to the day.
 */
export type LinkedPlayhead = Omit<Playhead, 'time'> & { time?: number };

/** What an explorer address holds, each part only when it is not the default: as it says it, its ids not yet checked against the network. */
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
  /** A route: the stations it starts and ends at, by id, either until both are picked; and the way between them drawn, fastest first, the fastest without one. */
  route?: RouteLink;
  /** The station a reach starts at. */
  reach?: string;
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
  /** The panel folded; open without one. */
  panelOpen?: false;
  /** Playback's speed, one of those offered; the default without one. */
  speed?: number;
  /** Playback's camera; following without one. */
  camera?: CameraMode;
  /** The minimap hidden while playing; shown without one. */
  minimap?: false;
};

/** A route as an address holds it, `route=bank,oval,1`: its ends, and the way between them drawn after the fastest. */
export type RouteLink = { from?: string; to?: string; option?: number };

/** An address's query, as the router gives it and takes it. */
export type ExplorerQuery = Record<string, string | null | (string | null)[] | undefined>;

/** What the explorer shows, as the stores hold it: what its address is worked out from (`explorerAddressOf`). */
export type AddressInput = {
  /** Where the history is, as an address names it, if known. */
  at: LinkedPlayhead | null;
  view: MapView | null;
  openStation: StationId | null;
  openLine: LineId | null;
  plan: PlanId | undefined;
  section: Section;
  /** The section a page opens on without a tab in its address: left out of it. */
  openingSection: Section;
  coverageMetres: CoverageDistance;
  routeEnds: RouteEnds;
  routeOption: number;
  reachFrom: Stop | null;
  viewMode: ViewMode;
  stationNames: boolean;
  streetNames: boolean;
  mapOnly: boolean;
  panelOpen: boolean;
  player: PlayerSettings;
};
