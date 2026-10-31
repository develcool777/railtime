import type { Ref } from 'vue';

/** What the layout works out from the browser. */
export type ExplorerLayout = {
  /** The panel's edge is being dragged. */
  resizing: Ref<boolean>;
  /** Starts dragging the panel's edge. */
  startResize: (event: PointerEvent) => void;
};
