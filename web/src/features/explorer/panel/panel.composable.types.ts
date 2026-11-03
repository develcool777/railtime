import type {
  ChangeInfo,
  LineColor,
  LineDetails,
  LineDirection,
  LineInfo,
  NetworkGrowth,
  NetworkRecords,
  ReachInfo,
  RouteInfo,
  StationInfo,
  StationSummary,
} from '@railtime/network/facts.types';
import type { ComputedRef } from 'vue';

import type { Section, SectionEntry } from '~/features/explorer/explorer.types';
import type { PanelTopContent } from '~/features/explorer/panel/panel.types';

/** What the panel and the page around the map show, read from the store and the network's facts. */
export type ExplorerPanel = {
  /** The rail's sections: Plans only for a city with plans. */
  sections: ComputedRef<SectionEntry[]>;
  /** Every line, in the theme's colours. */
  lines: ComputedRef<LineInfo[]>;
  /** Every change in the history, planned ones last. */
  changes: ComputedRef<ChangeInfo[]>;
  /** The line whose view is open, or under the station's, at the moment shown. */
  lineDetails: ComputedRef<LineDetails | null>;
  /** That line's changes. */
  lineChanges: ComputedRef<ChangeInfo[]>;
  /** The station whose view is open, at the moment shown. */
  station: ComputedRef<StationInfo | null>;
  /** The stations on the map at the moment shown; none while playing. */
  stations: ComputedRef<StationSummary[]>;
  /** Each station's lines' colours, to mark a line's interchanges. */
  stationColors: ComputedRef<Map<string, LineColor[]>>;
  /** The stops either side of the station whose view is open, on each of its lines, by line. */
  stationDirections: ComputedRef<Map<string, LineDirection[]>>;
  /** The change the map is at, for the Changes list. */
  currentChange: ComputedRef<number | null>;
  /** What the panel's top says. */
  panelTop: ComputedRef<PanelTopContent>;
  /** The date shown, for what had opened by then; `null` in a plan. */
  shownDate: ComputedRef<number | null>;
  /** The ways between the two stations picked on the date shown, fastest first, and the one drawn; `null` until both are picked, or while it is not drawn. */
  foundRoutes: ComputedRef<{ routes: RouteInfo[]; shown: number | null } | null>;
  /** Every station reached from the one picked, on the date shown; `null` until one is picked, while it is not drawn, or when no line calls there. */
  foundReach: ComputedRef<ReachInfo | null>;
  /** The network year by year, and the stations each decade opened. */
  growth: ComputedRef<NetworkGrowth | null>;
  /** Whether some year has a station on the map: one never built has only its plans. */
  hasHistory: ComputedRef<boolean>;
  /** Its records on the date shown. */
  records: ComputedRef<NetworkRecords | null>;
  /** The year shown on the map; `null` in a plan. */
  shownYear: ComputedRef<number | null>;
  /** The plan shown: its name, what became of it (its status) and what it adds, for the time control. */
  planSummary: ComputedRef<{ name: string; status: string; facts: string } | undefined>;
  /** The legend for the plan's dashed track, while the map shows it: its first line's colour, as CSS. */
  planLegend: ComputedRef<{ name: string; color: string } | null>;
  /** What is built today, for the Plans section's first card. */
  builtFacts: ComputedRef<string>;
  /** The dot on each section whose choice is in force while another is open. */
  marks: ComputedRef<Partial<Record<Section, string>>>;
};
