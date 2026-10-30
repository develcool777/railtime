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

/** A row of the piece of line a station's view draws: the stop before, the station, the stop after. */
export type StripStop = {
  id: string;
  name: string;
  /** The station whose view it is. */
  here: boolean;
  /** Beside it: where the line goes on past it, or that it is the end; empty for the station. */
  note: string;
};
