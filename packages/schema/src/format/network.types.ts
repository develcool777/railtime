import type { Brand } from '@railtime/core/brand.types';
import type { IsoDate } from '@railtime/core/date.types';
import type { LngLat } from '@railtime/core/geometry.types';

/**
 * The normalized network format: what importers produce and the renderer reads.
 * The renderer never sees OSM, Wikidata or GTFS, only this.
 *
 * Dates are ISO `YYYY-MM-DD` strings. Coordinates are `[longitude, latitude]`.
 */

/** A station's id, its key in `stations`: only a string checked to be one is (`parseNetwork`, a station looked up). */
export type StationId = Brand<string, 'StationId'>;

/** A line's id, its key in `lines`: only a string checked to be one is (`parseNetwork`, a line looked up). */
export type LineId = Brand<string, 'LineId'>;

/** A network's id, its key in `networks`: a family of lines run as one brand. */
export type NetworkId = Brand<string, 'NetworkId'>;

/** A plan's id, its key in `plans`. */
export type PlanId = Brand<string, 'PlanId'>;

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
  /**
   * Part of the city, but hidden when it opens, until shown: a network beside the city's own, as
   * main-line suburban trains are beside a metro. Hidden, as any line can be, it is as if it were not there.
   */
  hidden?: boolean;
  /** A network hidden at first that is older than the city's own: where the timeline starts while it shows, before the city's `start`. */
  start?: IsoDate;
};

/** Until `until`, the line is drawn and named as line `as`: a branch shown as its parent line until it became its own. */
export type LineAlias = {
  until: IsoDate;
  as: LineId;
  /** Shown when the line takes on its own identity. */
  text: string;
};

/** A line, as people know it. */
export type Line = {
  /** Its English name, short: the line's own, which the app shows followed by "line". */
  name: string;
  /** Its name as people say it, where "<name> line" is not: "DLR". */
  fullName?: string;
  /** Its name in other languages, in full as people say it there: "Святошинсько-Броварська лінія". */
  names?: Names;
  network: NetworkId;
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
  infill?: Record<LineId, IsoDate>;
  /** Lines that stopped calling here while still running through: line id to date. */
  closed?: Record<LineId, IsoDate>;
  /** Spells a line ran through here without calling, the station closed for a while: line id to its spells, oldest first. */
  suspended?: Record<LineId, Suspension[]>;
  /** Lines that run through here and never call: a line's fast track beside another's stopping one. */
  passes?: LineId[];
  /** Lines whose trains end here and go back the way they came, from two directions: their track may turn back at it. */
  reverses?: LineId[];
  /** Its earlier names, oldest first. */
  formerNames?: FormerName[];
};

/** A spell without trains a line later returned from: over a segment, or calling at a station. */
export type Suspension = {
  /** The first day without them. */
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
  stationA: StationId;
  stationB: StationId;
  /** From station A to station B. */
  coordinates: LngLat[];
  lines: Record<LineId, SegmentLine>;
};

/** Two stations, each its own stop with its own name, that passengers change between (Bank and Monument). */
export type Transfer = {
  stationA: StationId;
  stationB: StationId;
};

/** A stretch of line a plan builds, through its stations in order. */
export type PlanSection = {
  line: LineId;
  /**
   * Station ids: the network's or the plan's. A new station between two neighbours on the line's
   * track stands on that track; anywhere else, the section runs from station to station over the
   * plan's track between them (`Plan.track`), straight where it has none.
   */
  stations: StationId[];
};

/**
 * Where a plan's new track runs between two stations a section links: over a bridge, round a curve. As
 * a segment's, from station A to station B, held to the same: its ends on its stations, no turn
 * sharper than its trains can.
 */
export type PlanTrack = {
  stationA: StationId;
  stationB: StationId;
  /** From station A to station B. */
  coordinates: LngLat[];
};

/**
 * How far a plan got: being built; adopted by the city; proposed by an official body but not
 * adopted; an unofficial concept; or dropped, never to be built.
 */
export type PlanStatus = 'under-construction' | 'planned' | 'proposed' | 'concept' | 'abandoned';

/**
 * A plan drawn up for the network, whatever became of it (its `status`): lines and stations it would add, and the sections it would build,
 * in the order they are built. Undated: its order is all the time it has (see `buildPlan`).
 */
export type Plan = {
  name: string;
  names?: Names;
  status: PlanStatus;
  /** What it is, who drew it up and how far it got: shown on its card. */
  description?: string;
  lines?: Record<LineId, Line>;
  stations?: Record<StationId, Station>;
  sections: PlanSection[];
  /** Where its new track runs, between stations its sections link with no track yet; straight between any others. */
  track?: PlanTrack[];
  transfers?: Transfer[];
};

/** A city's rail network and its history. */
export type Network = {
  meta: {
    city: string;
    /** Its country, as a list of cities shows it; its folder in `cities/` is this in lower case, hyphenated. */
    country: string;
    /** Where the timeline starts. */
    start: IsoDate;
    built: IsoDate;
    attribution: string;
  };
  networks: Record<NetworkId, NetworkInfo>;
  lines: Record<LineId, Line>;
  stations: Record<StationId, Station>;
  segments: Segment[];
  /** Changes between stations that are not one station: drawn linked, wherever both are open. */
  transfers?: Transfer[];
  /** Its plans, by id: none is part of the network until chosen (see `buildPlan`). */
  plans?: Record<PlanId, Plan>;
};
