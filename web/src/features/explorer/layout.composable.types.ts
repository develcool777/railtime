import type { Padding } from '@railtime/renderer/transitMap.types';
import type { Ref } from 'vue';

import type { SheetSnap, TimeMode } from '~/features/explorer/explorer.types';

/** The explorer's layout: phone or not, the panel beside the map, the phone's sheet, map only. */
export type ExplorerLayout = {
  /** Below the rail's width: the panel a sheet over the map. */
  phone: Ref<boolean>;
  /** How high the phone's sheet stands. */
  sheet: Ref<SheetSnap>;
  /** Whether the panel is open beside the map; kept in a cookie. */
  panelOpen: Ref<boolean>;
  /** The panel's width beside the map, pixels; kept in a cookie. */
  panelWidth: Ref<number>;
  /** The panel's edge is being dragged. */
  resizing: Ref<boolean>;
  /** Starts dragging the panel's edge. */
  startResize: (event: PointerEvent) => void;
  /** Brings the panel into sight: unfolds it, or raises the phone's sheet to half. */
  revealPanel: () => void;
  /** Folds or unfolds the panel beside the map; nothing on a phone. */
  togglePanel: () => void;
  /** Only the map: the header, rail, panel and time control hidden. */
  mapOnly: Ref<boolean>;
  /** Enters or leaves map only, full screen where the browser lets it. */
  toggleMapOnly: () => Promise<void>;
  /** Room the camera keeps clear of the cards on the map, for the time control's size. */
  mapPadding: (mode: TimeMode) => Padding;
};
