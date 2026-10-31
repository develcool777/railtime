import type { ChangeInfo } from '@railtime/network/facts.types';

/** The changes of one decade, under its heading. */
export type ChangeGroup = {
  /** "1930s", or "Future" for a plan's. */
  decade: string;
  changes: ChangeInfo[];
};
