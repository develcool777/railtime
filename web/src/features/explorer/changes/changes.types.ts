import type { ChangeInfo } from '@railtime/network/facts.types';

/** The changes of one decade, under its heading. */
export type ChangeGroup = {
  /** "1930s", or "Future" for a plan's. */
  decade: string;
  changes: ChangeInfo[];
};

/** How a change's row is drawn: done, the current one, or still ahead (none), as Nuxt UI's timeline marks its items. */
export type ChangeState = 'completed' | 'active' | undefined;

/** One row of the Changes list: a change, under its decade's heading if it is the decade's first, the last with no line on. */
export type ChangeRow = { key: string; change: ChangeInfo; decade: string; heading: boolean; last: boolean };
