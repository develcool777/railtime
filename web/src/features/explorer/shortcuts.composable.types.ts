import type { Section } from '~/features/explorer/explorer.types';

/** What the explorer's keys need beyond the store: the time control's actions, and the sections. */
export type ExplorerShortcutActions = {
  /** The rail's sections, for the number keys, in its order. */
  sections: { id: Section }[];
  toggleTimeline: () => void;
  togglePlay: () => void;
  stepTime: (direction: -1 | 1) => void;
};
