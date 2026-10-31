import type { TransitMap } from '@railtime/renderer/transitMap.service';
import type { ChangeInfo, LineInfo, MapView, Padding, StepInfo, TimeState } from '@railtime/renderer/transitMap.types';
import type { Network } from '@railtime/schema/network.types';
import type { Ref, ShallowRef } from 'vue';

/** What `useTransitMap` mounts the map with. */
export type TransitMapMount = {
  /** Where the main map goes. */
  container: Readonly<ShallowRef<HTMLElement | null>>;
  /** Where the minimap goes. */
  minimapContainer: Readonly<ShallowRef<HTMLElement | null>>;
  network: Network;
  /** Where the map opens; the whole network without one. */
  view?: MapView;
  /** One of the network's plans, built on top of it. */
  plan?: string;
  /** Room the camera keeps clear of the cards on the map, for the layout now: read at mount and on each resize. */
  padding: () => Padding;
  /** How much of the map's left a panel covers, pixels: the map opens clear of it. */
  cover: () => number;
  /** A station clicked on the map, or `null` for a click away from any. */
  onStationClick: (id: string | null) => void;
  /** The station open is not on the map on the date now shown. */
  onSelectionGone: () => void;
};

/** The mounted map, and its events as reactive state. */
export type TransitMapBinding = {
  /** The map, for commands. `null` until mounted. */
  map: ShallowRef<TransitMap | null>;
  /** The clock, cursor and stats. */
  time: Ref<TimeState | null>;
  /** The change playing now, for the caption. */
  step: Ref<StepInfo | null>;
  /** Every line, with its colour in the current theme. */
  lines: Ref<LineInfo[]>;
  /** Every change in the timeline, planned ones last, coloured for the current theme. */
  changes: Ref<ChangeInfo[]>;
  /** Where the map looks, once it stops moving. */
  view: Ref<MapView | null>;
};
