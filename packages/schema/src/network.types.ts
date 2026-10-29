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

/**
 * Names in languages other than English, by BCP 47 language code (`uk`, `pt-BR`). The English name
 * is the thing's `name`; a language without an entry falls back to it.
 */
export type Names = Record<string, string>;

/** What kind of railway a line is: decides how it is classified and counted, not how it is drawn. */
export type Mode = 'metro' | 'light-metro' | 'tram' | 'suburban-rail' | 'rail' | 'cable';

/** A family of lines run as one brand. */
export type NetworkInfo = {
  name: string;
  names?: Names;
};

/** Until `until`, the line is drawn and named as line `as`: a branch shown as its parent line until it became its own. */
export type LineAlias = {
  until: IsoDate;
  as: string;
  /** Shown when the line takes on its own identity. */
  text: string;
};

/** A line, as people know it. */
export type Line = {
  /** Its English name, short: "Victoria", shown as "Victoria line". */
  name: string;
  /** Its name in other languages, in full as people say it there: "Святошинсько-Броварська лінія". */
  names?: Names;
  network: string;
  mode: Mode;
  color: string;
  /** Used on dark backgrounds where `color` would disappear (a black line). */
  darkColor?: string;
  aliases?: LineAlias[];
  /** Exists only as an alias target: never toggled or listed on its own. */
  pseudo?: boolean;
};

/** A name a station had until a date. */
export type FormerName = {
  name: string;
  names?: Names;
  until: IsoDate;
};

/** A station. */
export type Station = {
  /** Its name today, or when it closed. */
  name: string;
  /** That name in other languages. */
  names?: Names;
  coordinate: LngLat;
  /** Lines this station opened on after the line was already running through it: line id to date. */
  infill?: Record<string, IsoDate>;
  /** Lines that stopped calling here while still running through: line id to date. */
  closed?: Record<string, IsoDate>;
  /** Its earlier names, oldest first. */
  formerNames?: FormerName[];
};

/** A spell a line did not run over a segment it later returned to. */
export type Suspension = {
  /** The first day without trains. */
  from: IsoDate;
  /** The day they returned. */
  until: IsoDate;
};

/** When a line opened, and if it did, closed, on a segment. */
export type SegmentLine = {
  open: IsoDate;
  close?: IsoDate;
  /** Spells between `open` and `close` without trains, oldest first. */
  suspended?: Suspension[];
};

/** Track between two adjacent stations, shared by every line that runs over it. */
export type Segment = {
  stationA: string;
  stationB: string;
  /** From station A to station B. */
  coordinates: LngLat[];
  lines: Record<string, SegmentLine>;
};

/** Two stations, each its own stop with its own name, that passengers change between (Bank and Monument). */
export type Transfer = {
  stationA: string;
  stationB: string;
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
  /** Changes between stations that are not one station: drawn linked, wherever both are open. */
  transfers?: Transfer[];
};
