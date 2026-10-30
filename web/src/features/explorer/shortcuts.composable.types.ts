import type { Ref } from 'vue';

import type { Section } from '~/features/explorer/explorer.types';

/** What the explorer's keys do: each the action a button elsewhere on the page does. */
export type ExplorerShortcutActions = {
  /** The rail's sections, for the number keys, in its order. */
  sections: { id: Section }[];
  openSection: (id: Section) => void;
  openSearch: () => void;
  togglePanel: () => void;
  toggleTimeline: () => void;
  togglePlay: () => void;
  stepTime: (direction: -1 | 1) => void;
  toggleStationNames: () => void;
  mapOnly: Ref<boolean>;
  toggleMapOnly: () => Promise<void>;
  /** Whether a line's or a station's view is pushed over the section, for Esc to go back from. */
  hasPushedView: () => boolean;
  goBack: () => void;
};
