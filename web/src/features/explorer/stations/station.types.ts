import type { StationSummary } from '@railtime/renderer/transitMap.types';

/** A stop one along a line, and the end of the line that way. */
export type StopToward = {
  id: string;
  name: string;
  /** The last stop that way; `null` when it is that stop. */
  towards: string | null;
};

/** The stops either side of a station on a run of a line: none past an end. */
export type LineDirection = {
  previous: StopToward | null;
  next: StopToward | null;
};

/** The stations whose names begin with one letter. */
export type StationGroup = { letter: string; stations: StationSummary[] };
