import type { TransitMap } from '@railtime/renderer/transitMap.service';
import type { LineInfo, MapView, StationInfo, StepInfo, TimeState } from '@railtime/renderer/transitMap.types';
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
  /** The language to name things in; English without one. */
  language?: string;
};

/** The mounted map, and its events as reactive state. */
export type TransitMapBinding = {
  /** The map, for commands. `null` until mounted. */
  map: ShallowRef<TransitMap | null>;
  /** The clock, cursor and stats. */
  time: Ref<TimeState | null>;
  /** The change playing now, for the caption. */
  step: Ref<StepInfo | null>;
  /** How many of the step's stations have appeared. */
  revealed: Ref<number>;
  /** The station clicked last, if its panel is open. */
  station: Ref<StationInfo | null>;
  /** Every line, with its colour in the current theme. */
  lines: Ref<LineInfo[]>;
  /** Where the map looks, once it stops moving. */
  view: Ref<MapView | null>;
};
