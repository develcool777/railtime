import { defineShortcuts } from '#imports';

import { useExplorerStore } from '~/features/explorer/explorer.store';
import { SHORTCUTS } from '~/features/explorer/shortcuts.constants';
import type { Ref } from 'vue';

import type { Section } from '~/features/explorer/explorer.types';
import type { ShortcutAction } from '~/features/explorer/shortcuts.types';

/**
 * The explorer's keys (`SHORTCUTS`, which the help lists), the number keys opening the sections, and
 * Esc closing the innermost thing open. Each does what a button does: the store's action.
 *
 * @param sections - The rail's sections, for the number keys, in its order.
 */
export const useExplorerShortcuts = (sections: Readonly<Ref<{ id: Section }[]>>): void => {
  const store = useExplorerStore();

  const run: Record<ShortcutAction, () => void> = {
    search: () => store.setDialog('search'),
    help: () => store.setDialog('help'),
    panel: store.togglePanel,
    timeline: store.toggleTimeline,
    play: store.togglePlay,
    back: () => store.stepTime(-1),
    forward: () => store.stepTime(1),
    names: () => (store.stationNames = !store.stationNames),
    view3d: () => (store.viewMode = store.viewMode === '3d' ? '2d' : '3d'),
    mapOnly: () => store.setMapOnly(!store.mapOnly),
  };

  // An overlay or a menu closes itself on Esc; then map only, then a pushed view.
  const closeInnermost = () => {
    if (store.dialog || document.querySelector('[data-dismissable-layer]')) return;
    if (store.mapOnly) store.setMapOnly(false);
    else if (store.views.length > 0) store.goBack();
  };

  defineShortcuts({
    ...Object.fromEntries(SHORTCUTS.map(shortcut => [shortcut.key, run[shortcut.action]])),
    ...Object.fromEntries(sections.value.map((entry, position) => [String(position + 1), () => store.openSection(entry.id)])),
    escape: closeInnermost,
  });
};
