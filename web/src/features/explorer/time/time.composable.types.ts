import type { ComputedRef } from 'vue';

import type { TimelineTarget } from '~/features/explorer/time/timeline.types';
import type { TransitMapBinding } from '~/features/explorer/map/transitMap.composable.types';

/** What `useExplorerTime` reads. */
export type ExplorerTimeInput = {
  binding: TransitMapBinding;
  /** The plan shown, if any: its future is what plays, and its built network is "at rest". */
  plan?: string;
  /** The network was never built: there is no past to slide through. */
  planOnly: boolean;
  /** The change the map is at, to step back from while playing. */
  currentChange: ComputedRef<number | null>;
};

/** The time control: the date shown, the timeline, and playback. */
export type ExplorerTime = {
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
  /** Shows what the timeline was picked at; playing on from there if it was playing, but at the future, the end. */
  pick: (target: TimelineTarget) => void;
  /** A year back or forward; while playing, the change before or the next. */
  stepTime: (direction: -1 | 1) => void;
};
