import type { ShallowRef } from 'vue';

/** Where `useTransitMap` mounts the map. */
export type TransitMapMount = {
  /** Where the main map goes. */
  container: Readonly<ShallowRef<HTMLElement | null>>;
  /** Where the minimap goes. */
  minimapContainer: Readonly<ShallowRef<HTMLElement | null>>;
};
