import type { StationSummary } from '@railtime/network/facts.types';

/** The stations whose names begin with one letter. */
export type StationGroup = { letter: string; stations: StationSummary[] };

/** One row of the Stations list: a station, under its letter's heading if it is the letter's first (the list's first with no room above it). */
export type StationRow = { key: string; station: StationSummary; letter: string | null; first: boolean };

/** A row of the piece of line a station's view draws: the stop before, the station, the stop after. */
export type StripStop = {
  id: string;
  name: string;
  /** The station whose view it is. */
  here: boolean;
  /** Beside it: where the line goes on past it, or that it is the end; empty for the station. */
  note: string;
};
