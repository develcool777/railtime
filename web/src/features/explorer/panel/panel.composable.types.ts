import type { ChangeInfo, LineDetails, StationSummary } from '@railtime/renderer/transitMap.types';
import type { Network, Plan } from '@railtime/schema/network.types';
import type { ComputedRef, Ref } from 'vue';

import type { Section, TimeMode } from '~/features/explorer/explorer.types';
import type { ExplorerLayout } from '~/features/explorer/layout.composable.types';
import type { PanelTopContent } from '~/features/explorer/panel/panel.types';
import type { LineDirection } from '~/features/explorer/stations/station.types';
import type { TransitMapBinding } from '~/features/explorer/map/transitMap.composable.types';

/** What `useExplorerPanel` reads. */
export type ExplorerPanelInput = {
  network: Network;
  /** The plan shown, if any. */
  plan?: string;
  /** The section the panel opens on. */
  opening: Section;
  chosenPlan: ComputedRef<Plan | undefined>;
  planCount: number;
  binding: TransitMapBinding;
  layout: Pick<ExplorerLayout, 'phone' | 'panelOpen' | 'revealPanel'>;
  timeMode: Ref<TimeMode>;
};

/** The panel: its sections, the line or station view pushed over them, and what they list. */
export type ExplorerPanel = {
  /** The rail's sections: Plans only for a city with plans. */
  sections: { id: Section; label: string; icon: string }[];
  /** The section open. */
  section: Ref<Section>;
  /** The section the rail marks: the one a pushed view belongs to, else the one open. */
  railSection: ComputedRef<Section>;
  /** The line whose view is pushed over the section, if any. */
  openLine: Ref<string | null>;
  /** That line, on the date shown. */
  lineDetails: ComputedRef<LineDetails | null>;
  /** That line's changes. */
  lineChanges: ComputedRef<ChangeInfo[]>;
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
  /** A section picked on the rail: opens it, or folds the panel if it is the one open. */
  pickSection: (id: Section) => void;
  /** Opens a section over any pushed view, and brings the panel into sight. */
  openSection: (id: Section) => void;
  /** Back from a pushed view: along a walk to the station before, from a station to the line under it, else to the section. */
  goBack: () => void;
  /** Whether a line's or a station's view is pushed over the section. */
  hasPushedView: () => boolean;
  /** Pushes a line's view, and brings the panel into sight. */
  pushLine: (id: string) => void;
  /** Opens a station's view and rings it on the map. */
  openStation: (id: string) => void;
  /** Walks from the station whose view is open to another, which Back returns from. */
  walkTo: (id: string) => void;
  /** Closes the station's view and its ring. */
  closeStation: () => void;
  /** A change picked in a list: while playing, playback jumps to it; otherwise the map shows it. */
  pickChange: (index: number) => void;
  /** Shows the map just after a change. */
  showChange: (index: number) => void;
  /** Opens Changes for playback to follow, closing any pushed view. */
  followPlayback: () => void;
};
