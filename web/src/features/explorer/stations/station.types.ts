import type { StationSummary } from '@railtime/renderer/transitMap.types';

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
