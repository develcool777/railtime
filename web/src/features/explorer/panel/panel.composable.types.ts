import type { ChangeInfo, LineDetails, StationInfo, StationSummary } from '@railtime/renderer/transitMap.types';
import type { Network, Plan } from '@railtime/schema/network.types';
import type { ComputedRef, Ref } from 'vue';

import type { SectionEntry } from '~/features/explorer/explorer.types';
import type { PanelTopContent } from '~/features/explorer/panel/panel.types';
import type { LineDirection } from '~/features/explorer/stations/station.types';
import type { TransitMapBinding } from '~/features/explorer/map/transitMap.composable.types';

/** What `useExplorerPanel` reads. */
export type ExplorerPanelInput = {
  network: Network;
  /** The plan shown, if any. */
  plan?: string;
  chosenPlan: ComputedRef<Plan | undefined>;
  planCount: number;
  binding: TransitMapBinding;
};

/** The panel's content, read from the map for what the store has open. */
export type ExplorerPanel = {
  /** The rail's sections: Plans only for a city with plans. */
  sections: SectionEntry[];
  /** The line whose view is open, or under the station's, on the date shown. */
  lineDetails: ComputedRef<LineDetails | null>;
  /** That line's changes. */
  lineChanges: ComputedRef<ChangeInfo[]>;
  /** The station whose view is open, on the date shown. */
  station: Readonly<Ref<StationInfo | null>>;
  /** The stations on the map on the date shown; none while playing. */
  stations: ComputedRef<StationSummary[]>;
  /** Each station's lines' colours, to mark a line's interchanges. */
  stationColors: ComputedRef<Map<string, string[]>>;
  /** The stops either side of the station whose view is open, on each of its lines, by line. */
  stationDirections: ComputedRef<Map<string, LineDirection[]>>;
  /** The lines shown on the map. */
  visible: Ref<Set<string>>;
  /** Shows these lines on the map, and hides the rest. */
  setVisible: (next: Set<string>) => void;
  /** The change the map is at, for the Changes list. */
  currentChange: ComputedRef<number | null>;
  /** What the panel's top says. */
  panelTop: ComputedRef<PanelTopContent>;
  /** The date shown, for what had opened by then; `null` in a plan's future. */
  shownDate: ComputedRef<number | null>;
  /** A change picked in a list: while playing, playback jumps to it; otherwise the map shows it. */
  pickChange: (index: number) => void;
  /** Shows the map just after a change. */
  showChange: (index: number) => void;
};
