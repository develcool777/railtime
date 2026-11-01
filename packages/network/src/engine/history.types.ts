import type { YearStats } from '../facts/facts.types';

/** The network year by year, and the year each station first opened. */
export type NetworkHistory = {
  years: YearStats[];
  /** The year each station was first on the map, by id. */
  firstYears: Map<string, number>;
};

/** What is open at a cursor. */
export type OpenNetwork = {
  /** Each station a line calls at, with those lines as they are drawn. */
  stations: Map<string, Set<string>>;
  /** The track open, by segment. */
  segments: Set<number>;
  /** The lines open, as they are drawn. */
  lines: Set<string>;
};
