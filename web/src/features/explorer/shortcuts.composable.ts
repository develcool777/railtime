import { defineShortcuts } from '#imports';

import type { ExplorerShortcutActions } from '~/features/explorer/shortcuts.composable.types';

/**
 * The explorer's keys: `/` searches, `[` folds the panel, `1`–`5` open the sections, `H` the
 * timeline, Space plays or pauses, the arrows step through time, `N` names the stations, `F` is map
 * only, and Esc closes the innermost thing open.
 *
 * @param actions - What each key does.
 */
export const useExplorerShortcuts = (actions: ExplorerShortcutActions): void => {
  // A menu or the search closes itself on Esc; then map only, then a pushed view.
  const closeInnermost = () => {
    if (document.querySelector('[data-dismissable-layer]')) return;
    if (actions.mapOnly.value) void actions.toggleMapOnly();
    else if (actions.hasPushedView()) actions.goBack();
  };

  defineShortcuts({
    '/': actions.openSearch,
    '[': actions.togglePanel,
    ...Object.fromEntries(actions.sections.map((entry, position) => [String(position + 1), () => actions.openSection(entry.id)])),
    h: actions.toggleTimeline,
    ' ': actions.togglePlay,
    arrowleft: () => actions.stepTime(-1),
    arrowright: () => actions.stepTime(1),
    n: actions.toggleStationNames,
    f: () => void actions.toggleMapOnly(),
    escape: closeInnermost,
  });
};
