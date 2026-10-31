import type { ChangeInfo, LineDetails, LineDirection, LineInfo, StationInfo, StationSummary } from '@railtime/network/facts.types';
import type { ComputedRef } from 'vue';

import type { SectionEntry } from '~/features/explorer/explorer.types';
import type { PanelTopContent } from '~/features/explorer/panel/panel.types';

/** The panel's content, read from the network's model for what the store has open. */
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
  stationColors: ComputedRef<Map<string, string[]>>;
  /** The stops either side of the station whose view is open, on each of its lines, by line. */
  stationDirections: ComputedRef<Map<string, LineDirection[]>>;
  /** The lines shown on the map. */
  visible: ComputedRef<Set<string>>;
  /** Shows these lines on the map, and hides the rest. */
  setVisible: (next: Set<string>) => void;
  /** The change the map is at, for the Changes list. */
  currentChange: ComputedRef<number | null>;
  /** What the panel's top says. */
  panelTop: ComputedRef<PanelTopContent>;
  /** The date shown, for what had opened by then; `null` in a plan's future. */
  shownDate: ComputedRef<number | null>;
};
