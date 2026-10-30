import type { CameraMode } from '@railtime/renderer/transitMap.types';
import type { ComputedRef, Ref } from 'vue';

import type { TimeMode } from '~/features/explorer/explorer.types';
import type { TimelineTarget } from '~/features/explorer/time/timeline.types';
import type { TransitMapBinding } from '~/features/explorer/map/transitMap.composable.types';

/** What `useExplorerTime` reads. */
export type ExplorerTimeInput = {
  binding: TransitMapBinding;
  /** What the time control shows: driven here, read by the panel and the layout too. */
  timeMode: Ref<TimeMode>;
  /** The plan shown, if any: its future is what plays, and its built network is "at rest". */
  plan?: string;
  /** The network was never built: there is no past to slide through. */
  planOnly: boolean;
  /** The change the map is at, to step back from while playing. */
  currentChange: ComputedRef<number | null>;
  /** Called as playback starts, for the panel to follow it. */
  onPlay: () => void;
};

/** The time control: the date shown, the timeline, and playback. */
export type ExplorerTime = {
  speed: Ref<number>;
  camera: Ref<CameraMode>;
  /** The timeline's ends, and today. */
  range: ComputedRef<{ start: number; end: number; today: number }>;
  /** Opens the timeline; for a network never built, plays its plan. */
  openTimeline: () => void;
  /** Closes the timeline, back to the network as it is. */
  closeTimeline: () => void;
  /** Opens the timeline from rest, or closes it; leaves the player alone. */
  toggleTimeline: () => void;
  /** Plays: on from where it paused in the player, else the history from its start. */
  play: () => void;
  /** Plays or pauses. */
  togglePlay: () => void;
  /** Leaves the player for the timeline, at the date reached. */
  exitHistory: () => void;
  /** The network as it ends: with a plan, its future built; without, today. */
  showFuture: () => void;
  /** Shows today. */
  showToday: () => void;
  /** Shows what the timeline was picked at; playing on from there if it was playing. */
  pick: (target: TimelineTarget) => void;
  setSpeed: (value: number) => void;
  setCamera: (value: CameraMode) => void;
  /** A year back or forward; while playing, the change before or the next. */
  stepTime: (direction: -1 | 1) => void;
};
