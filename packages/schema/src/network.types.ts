/**
 * The normalized network format: what importers produce and the renderer reads.
 * The renderer never sees OSM, Wikidata or GTFS, only this.
 *
 * Dates are ISO `YYYY-MM-DD` strings. Coordinates are `[longitude, latitude]`.
 */

/** A `YYYY-MM-DD` date. */
export type IsoDate = string;

/** A `[longitude, latitude]` coordinate. */
export type LngLat = [number, number];

/** What kind of railway a line is: decides how it is classified and counted, not how it is drawn. */
export type Mode = 'metro' | 'light-metro' | 'tram' | 'suburban-rail' | 'rail' | 'cable';

/** A family of lines run as one brand (the Underground, the Overground). */
export type NetworkInfo = {
  name: string;
};

/** Until `until`, the line is drawn and named as line `as` (Hammersmith & City as Metropolitan before 1990). */
export type LineAlias = {
  until: IsoDate;
  as: string;
  /** Shown when the line takes on its own identity. */
  text: string;
};

/** A line, as people know it. */
export type Line = {
  name: string;
  network: string;
  mode: Mode;
  color: string;
  /** Used on dark backgrounds where `color` would disappear (the black Northern line). */
  darkColor?: string;
  aliases?: LineAlias[];
  /** Exists only as an alias target: never toggled or listed on its own. */
  pseudo?: boolean;
};

/** A name a station had until a date (G-Mex, until Deansgate-Castlefield in 2010). */
export type FormerName = {
  name: string;
  until: IsoDate;
};

/** A station. */
export type Station = {
  /** Its name today, or when it closed. */
  name: string;
  coordinate: LngLat;
  /** Lines this station opened on after the line was already running through it: line id to date. */
  infill?: Record<string, IsoDate>;
  /** Lines that stopped calling here while still running through: line id to date (Mosley Street, 2013). */
  closed?: Record<string, IsoDate>;
  /** Its earlier names, oldest first. */
  formerNames?: FormerName[];
};

/** When a line opened, and if it did, closed, on a segment. */
export type SegmentLine = {
  open: IsoDate;
  close?: IsoDate;
};

/** Track between two adjacent stations, shared by every line that runs over it. */
export type Segment = {
  stationA: string;
  stationB: string;
  /** From station A to station B. */
  coordinates: LngLat[];
  lines: Record<string, SegmentLine>;
};

/** A city's rail network and its history. */
export type Network = {
  meta: {
    city: string;
    /** Where the timeline starts. */
    start: IsoDate;
    built: IsoDate;
    attribution: string;
  };
  networks: Record<string, NetworkInfo>;
  lines: Record<string, Line>;
  stations: Record<string, Station>;
  segments: Segment[];
};
