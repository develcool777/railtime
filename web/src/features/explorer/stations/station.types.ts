import type { LineColor, StationSummary } from '@railtime/network/facts.types';
import type { StationId } from '@railtime/schema/network.types';

/** The stations whose names begin with one letter. */
export type StationGroup = { letter: string; stations: StationSummary[] };

/** One row of the Stations list: a station, its letter's heading over it if it is the letter's first; no letter for what a search found. */
export type StationRow = { key: string; station: StationSummary; letter: string; heading: boolean };

/** A row of the piece of line a station's view draws: the stop before, the station, the stop after. */
export type StripStop = {
  id: StationId;
  name: string;
  /** The station whose view it is. */
  here: boolean;
  /** Beside it: where the line goes on past it, or that it is the end; empty for the station. */
  note: string;
};

/** A station as a station field's list holds it: its name, its first other name beneath, its lines' colours beside. */
export type StationChoice = { id: StationId; label: string; description?: string; colors: LineColor[] };
