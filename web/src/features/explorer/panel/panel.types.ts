import type { ChangeInfo, LineInfo, TimeState } from '@railtime/renderer/transitMap.types';

import type { Section } from '~/features/explorer/explorer.types';

/** What the panel's top says: the view's title, a line of context, and the way back from a pushed view. */
export type PanelTopContent = {
  title: string;
  context: string;
  /** Line colours leading the context. */
  dots?: string[];
  /** Where the back link returns to; none on a section's own list. */
  backLabel?: string;
};

/** What a section's top is worked out from. */
export type SectionTopInput = {
  section: Section;
  /** The section's name, as the rail shows it. */
  label: string;
  /** The time control is the player: Changes follows playback. */
  playing: boolean;
  /** A plan is shown: what plays is its future. */
  hasPlan: boolean;
  lines: LineInfo[];
  /** The lines shown on the map. */
  visible: Set<string>;
  changes: ChangeInfo[];
  /** The change the map is at, if any. */
  currentChange: number | null;
  time: TimeState | null;
  /** How many plans the city has. */
  planCount: number;
};
