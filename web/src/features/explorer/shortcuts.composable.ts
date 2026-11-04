import { defineShortcuts } from '#imports';

import { useExplorerStore } from '~/features/explorer/explorer.store';
import { usePanelStore } from '~/features/explorer/panel/panel.store';
import { SHORTCUTS } from '~/features/explorer/shortcuts.constants';
import type { ShortcutAction } from '~/features/explorer/shortcuts.types';
import { useTimeStore } from '~/features/explorer/time/time.store';

/**
 * The explorer's keys (`SHORTCUTS`, which the help lists), the number keys opening the rail's
 * sections, and Esc closing the innermost thing open: an effect, and nothing else. Each does what a
 * button does: a store's action.
 */
export const useExplorerShortcuts = (): void => {
  const store = useExplorerStore();
  const timeStore = useTimeStore();
  const panel = usePanelStore();

  const run: Record<ShortcutAction, () => void> = {
    search: () => store.SET_DIALOG('search'),
    help: () => store.SET_DIALOG('help'),
    panel: () => store.TOGGLE_PANEL(),
    rest: () => timeStore.LEAVE_TO('rest'),
    play: () => timeStore.TOGGLE_PLAY(),
    back: () => timeStore.STEP_TIME(-1),
    forward: () => timeStore.STEP_TIME(1),
    names: () => store.SET_STATION_NAMES(!store.stationNames),
    streets: () => store.SET_STREET_NAMES(!store.streetNames),
    view3d: () => store.SET_VIEW_MODE(store.viewMode === '3d' ? '2d' : '3d'),
    mapOnly: () => store.SET_MAP_ONLY(!store.mapOnly),
  };

  // An overlay or a menu closes itself on Esc; then map only, then a pushed view.
  const closeInnermost = () => {
    if (store.dialog || document.querySelector('[data-dismissable-layer]')) return;
    if (store.mapOnly) store.SET_MAP_ONLY(false);
    else if (store.views.length > 0) store.GO_BACK();
  };

  defineShortcuts({
    ...Object.fromEntries(SHORTCUTS.map(shortcut => [shortcut.key, run[shortcut.action]])),
    ...Object.fromEntries(panel.sections.map((entry, position) => [String(position + 1), () => store.OPEN_SECTION(entry.id)])),
    escape: closeInnermost,
  });
};
