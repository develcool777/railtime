import type { Padding } from '@railtime/renderer/transitMap.types';
import type { ComputedRef, Ref } from 'vue';

/** What the layout works out from the store and the browser. */
export type ExplorerLayout = {
  /** How much of the map's left the panel covers, pixels: its width while open beside the map, else none. */
  panelCover: ComputedRef<number>;
  /** The panel's edge is being dragged. */
  resizing: Ref<boolean>;
  /** Starts dragging the panel's edge. */
  startResize: (event: PointerEvent) => void;
  /** Room the camera keeps clear of the cards on the map, for the time control's size now. */
  mapPadding: () => Padding;
};
