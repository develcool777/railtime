import type { CoverageDistance, Moment } from '@railtime/network/facts.types';
import type { MapView, ViewMode } from '@railtime/renderer/transitMap.types';
import type { LineId, PlanId, StationId } from '@railtime/schema/network.types';
import type { PlayerSettings, Section } from '~/features/explorer/explorer.types';
import type { RouteEnds } from '~/features/explorer/tools.types';

/** How a page is set: each has a value without the address saying (`ADDRESS_SETTINGS`), and the address says only what differs. */
export type ExplorerSettings = PlayerSettings & {
  /** How far from a station coverage counts. */
  walk: CoverageDistance;
  /** In 3D, or flat. */
  viewMode: ViewMode;
  /** Station names shown. */
  stationNames: boolean;
  /** The basemap's street and place names shown. */
  streetNames: boolean;
  /** Trains running on the lines. */
  trains: boolean;
  /** Only the map, or the page around it. */
  mapOnly: boolean;
  /** The panel open, or folded. */
  panelOpen: boolean;
};

/** One setting as the address holds it. */
export type AddressSetting<Value> = {
  /** Its parameter. */
  param: string;
  /** What it is without the parameter, which is then left out. */
  fallback: Value;
  /** The values it may hold, each as the parameter writes it: anything else is a bad link. */
  offered: readonly (readonly [text: string, value: Value])[];
};

/** What an explorer address holds: its settings, and the rest only where it names them, as it says it, its ids not yet checked against the network. */
export type ExplorerUrlState = ExplorerSettings & {
  /** Where in the network's history the map is; today, or with a plan the plan built, without one. */
  at?: Moment;
  /** Where the map looks; the whole network without one. */
  view?: MapView;
  /** The station whose panel is open. */
  station?: string;
  /** The plan shown on top of the network; none without one. */
  plan?: string;
  /** The panel's section open; the one the page opens on without one. */
  section?: Section;
  /** A route: the stations it starts and ends at, by id, either until both are picked; and the way between them drawn, fastest first, the fastest without one. */
  route?: RouteLink;
  /** The station a reach starts at. */
  reach?: string;
  /** The line whose view is open, or under the station's; none without one. */
  line?: string;
};

/** A route as an address holds it, `route=bank,oval,1`: its ends, and the way between them drawn after the fastest. */
export type RouteLink = { from?: string; to?: string; option?: number };

/** An address's query, as the router gives it and takes it. */
export type ExplorerQuery = Record<string, string | null | (string | null)[] | undefined>;

/** The address bar, as the page gives it to the effect that writes it (`useExplorerAddress`). */
export type AddressBar = {
  /**
   * What it says now.
   *
   * @returns Its query.
   */
  query: () => ExplorerQuery;
  /**
   * Says something else, in place, no step added to the browser's history.
   *
   * @param query - The query.
   */
  replace: (query: Record<string, string>) => void;
};

/** What the explorer shows, as the stores hold it: what its address is worked out from (`explorerAddressOf`). */
export type AddressInput = {
  /** Where the history is, as an address names it, if known. */
  at: Moment | null;
  view: MapView | null;
  openStation: StationId | null;
  openLine: LineId | null;
  plan: PlanId | undefined;
  section: Section;
  /** The section a page opens on without a tab in its address: left out of it. */
  openingSection: Section;
  routeEnds: RouteEnds;
  routeOption: number;
  reachFrom: StationId | null;
  settings: ExplorerSettings;
};
