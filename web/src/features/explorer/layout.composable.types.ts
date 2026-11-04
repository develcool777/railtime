/** What the layout's effects give the page: the start of a drag of the panel's edge. */
export type ExplorerLayout = {
  /** Starts dragging the panel's edge. */
  startResize: (event: PointerEvent) => void;
};
