import type { IsoDate } from '@railtime/core/date.types';
import type { LngLat } from '@railtime/core/geometry.types';
import type { CityIndexEntry } from '@railtime/schema/cityIndex.types';
import type { LineId, Network, NetworkId, PlanId, PlanStatus, StationId } from '@railtime/schema/network.types';
import type { LineGap, Step } from '../engine/engine.types';
import type { NetworkIndex } from '../engine/index.service';
import type { Timeline } from '../engine/timeline.service';

/** The map's colour theme. */
export type Theme = 'dark' | 'light';

/** A line's colour in each theme: an answer holds both, and what shows it picks the one for its theme. */
export type LineColor = Record<Theme, string>;

/**
 * One line's track in a sketch of the network: what is open today, or for a network never built, its
 * first plan's, drawn dashed.
 */
export type LineSketch = { line: LineId; color: LineColor; paths: LngLat[][]; dashed: boolean };

/** What is on the map. */
export type NetworkStats = { stations: number; km: number; lines: number };

/** The change playing now, for a caption. */
export type StepInfo = {
  kind: Step['kind'];
  /** Its date; `null` for a planned step, which has none. */
  time: number | null;
  title: string;
  /** The first and last station it reaches: "<station> – <station>". */
  subtitle?: string;
  color: LineColor;
  /** The names of the stations this step opens, in the order they appear. */
  stations: string[];
};

/** One change in the timeline, for a list of changes: its caption and where it plays. */
export type ChangeInfo = StepInfo & {
  /** Its position in the timeline: what `showChange` and `playFrom` take. */
  index: number;
};

/** One line at a station, for a station panel. */
export type StationLineInfo = {
  id: LineId;
  name: string;
  color: LineColor;
  /** When it opened here; `null` for a plan's line, which has no date. */
  opened: IsoDate | null;
  closed?: IsoDate;
  /** Whether it calls here at the moment asked for: its track here open, the station open on it, and not closed for a spell. */
  calls: boolean;
};

/** A station, for a station panel. */
export type StationInfo = {
  id: StationId;
  /** Its name on the date shown. */
  name: string;
  /** That name in the network's other languages. */
  otherNames: string[];
  lines: StationLineInfo[];
  /** The names it had before the date shown, oldest first. */
  formerNames: FormerNameInfo[];
  /** Stations to change to from here, on the date shown. */
  transfers: TransferInfo[];
};

/** A name a station had, with its names in other languages, and the day it changed. */
export type FormerNameInfo = { name: string; otherNames: string[]; until: IsoDate };

/** A station to change to, and the lines it has on the date shown. */
export type TransferInfo = { id: StationId; name: string; lines: { id: LineId; name: string; color: LineColor }[] };

/** A line, for a legend or toggles. */
export type LineInfo = {
  id: LineId;
  name: string;
  network: NetworkId;
  networkName: string;
  color: LineColor;
  /** When it first opened, as a timestamp; `null` for a line only a plan builds. */
  opened: number | null;
};

/** A station as a search lists it: on the map on the date shown. */
export type StationSummary = {
  id: StationId;
  /** Its name on the date shown. */
  name: string;
  /** That name in the network's other languages. */
  otherNames: string[];
  /** The colours of the lines that call there, in line order. */
  colors: LineColor[];
};

/** A station on a line or a route, by its id and its name on the date shown. */
export type Stop = { id: StationId; name: string };

/** A line on the date shown, for a line's panel. */
export type LineDetails = LineInfo & {
  /** Its stops on the date shown. */
  stations: number;
  /** Its open track on the date shown, km. */
  km: number;
  /**
   * Its stops in the order it runs, as runs of track: the longest first, then each branch, whose
   * first stop is the station it leaves from. Empty when it is not open.
   */
  branches: Stop[][];
  /** The changes that are part of its story, by their position in the timeline (`ChangeInfo.index`). */
  changes: number[];
};

/** What a route is best at among the ways offered: arriving soonest, or changing least. */
export type RouteStrength = 'fastest' | 'fewest-changes';

/** One part of a route: a ride on a line from where it is boarded to where it is left, or a walk between two stations. */
export type RouteLegInfo =
  | {
      kind: 'ride';
      line: LineId;
      lineName: string;
      color: LineColor;
      /** Its stops, from the one boarded at to the one left at. */
      stops: Stop[];
      minutes: number;
      km: number;
    }
  | { kind: 'walk'; from: Stop; to: Stop; minutes: number };

/** How to get from one station to another on the date shown. */
export type RouteInfo = {
  from: Stop;
  to: Stop;
  legs: RouteLegInfo[];
  /** About how long it takes, changes and walks included. */
  minutes: number;
  /** How far it rides. */
  km: number;
  /** How many times it changes line. */
  changes: number;
  /** The track it rides, by segment: what a route overlay draws. */
  segments: number[][];
  /** What it is best at among the ways offered: none for a way that is neither, but another. */
  best: RouteStrength[];
};

/** A band of a reach: the stations reached within its minutes, in its colour. */
export type ReachBand = {
  /** The most minutes in it; `null` for the last, which has no end. */
  upTo: number | null;
  /** "15–30 min". */
  label: string;
  color: string;
};

/** A station a reach gets to. */
export type ReachStation = { id: StationId; name: string; minutes: number; band: number };

/** How far one can get from a station on the date shown, and how long it takes. */
export type ReachInfo = {
  from: Stop;
  /** Every other station reached, soonest first. */
  stations: ReachStation[];
  /** The bands its stations are coloured in, soonest first. */
  bands: ReachBand[];
  /**
   * The track it colours: each segment open at the moment with a reached station at an end (the
   * start's included), in the band of its ends' mean time, or its one end's.
   */
  track: { segment: number; band: number }[];
};

/** A band of walking distance to the nearest station, nearest first. */
export type CoverageBand = {
  /** The most metres in it. */
  upTo: number;
  /** "400–800 m". */
  label: string;
  color: string;
};

/** How far from a station coverage counts, metres: a 5- to 25-minute walk, about, each a band's far edge. */
export type CoverageDistance = 400 | 800 | 1200 | 1600 | 2000;

/** A band, and how much of the city lies in it. */
export type CoverageShare = CoverageBand & {
  /** Of the city's area, 0..1. */
  share: number;
  km2: number;
};

/** How much of a city lies within walking distance of a station open on the date shown. */
export type CoverageInfo = {
  /** What the city's outline is: "Greater London". */
  name: string;
  /** Where the outline comes from, as credited. */
  source: string;
  /** The city's area inside its outline. */
  km2: number;
  /** The headline: the share within this many metres. */
  metres: CoverageDistance;
  /** The share of the city within `metres` of a station, 0..1. */
  share: number;
  /** Each band, nearest first. */
  bands: CoverageShare[];
  /** What lies farther than every band. */
  beyond: { share: number; km2: number };
};

/** The grid's image corners, as MapLibre's image source takes them: top left, top right, bottom right, bottom left. */
export type GridCorners = [LngLat, LngLat, LngLat, LngLat];

/** A city's coverage at a moment, cell by cell: what a picture of it is drawn from. */
export type CoverageCells = {
  columns: number;
  rows: number;
  /** Where the cells lie: top left, top right, bottom right, bottom left. */
  corners: GridCorners;
  /** The bands, nearest first. */
  bands: CoverageBand[];
  /**
   * Each cell, row by row from the north: its band's place in `bands`; `bands.length` for the city
   * beyond every band; -1 outside its outline.
   */
  cells: Int8Array;
};

/** The share of a city within the headline distance of a station at the end of a year. */
export type CoverageYear = { year: number; share: number };

/** The network at the end of one year. */
export type YearStats = { year: number; stations: number; km: number; lines: number };

/** How many stations first opened in a decade. */
export type DecadeOpenings = { decade: number; stations: number };

/** The network year by year, and how many stations opened in each decade. Plans have no date and are not in it. */
export type NetworkGrowth = { years: YearStats[]; decades: DecadeOpenings[] };

/** The network's records on the date shown, each list longest or oldest first. */
export type NetworkRecords = {
  /** The stations open longest, with the year each first opened. */
  oldest: { id: StationId; name: string; year: number }[];
  /** The stations most lines call at. */
  busiest: { id: StationId; name: string; lines: { id: LineId; name: string; color: LineColor }[] }[];
  /** The longest lines. */
  longest: { id: LineId; name: string; color: LineColor; km: number }[];
};

/** A stop one along a line, and the end of the line that way. */
export type StopToward = {
  id: StationId;
  name: string;
  /** The last stop that way; `null` when it is that stop. */
  towards: string | null;
};

/** The stops either side of a station on a run of a line: none past an end. */
export type LineDirection = {
  previous: StopToward | null;
  next: StopToward | null;
};

/** What a plan would add to its network, for its card. */
export type PlanFacts = {
  /** Its new stations. */
  stations: number;
  /** Its new track, km. */
  km: number;
  /** The lines its sections build on, in the order they first come. */
  lines: { id: LineId; name: string; color: LineColor }[];
};

/** One of a city's plans, for its card. */
export type PlanInfo = {
  id: PlanId;
  name: string;
  status: PlanStatus;
  description?: string;
  /** What it would add to the network. */
  facts: PlanFacts;
};

/** A network summed up, for a list of cities. */
export type NetworkSummary = Omit<CityIndexEntry, 'name' | 'country'>;

/**
 * A position in the network's history, as a video's playhead is one in the video: the changes done, the
 * clock, and how far the next change has been drawn. The same in 2D and 3D and at any speed, which change
 * only how fast it moves: the map reports one (`TimeState`), seeks one and the app's address holds one.
 */
export type Playhead = {
  /** Changes done, a plan's too: the sequence number, as exact as a day is not (many changes share one). */
  cursor: number;
  /**
   * The clock, as a UTC timestamp: in the years after the last change done, up to the next one's date;
   * a plan's change has none and plays at the end of the range.
   */
  time: number;
  /** How far the next change has been drawn, 0 to 1: 0 between changes. The facts count only the changes done. */
  progress: number;
};

/** What `NetworkFacts` is made with besides the network. */
export type NetworkFactsOptions = {
  /** One of the network's plans, built on it: its sections play after every dated change. */
  plan?: PlanId;
  /**
   * Its lines hidden, as if they were not there: by a line's id, or a network's for all its lines,
   * as an address gives them (those it does not have name nothing). Without them, those of its
   * networks hidden at first.
   */
  hidden?: readonly string[];
  /** Today, as a UTC timestamp at midnight: where the map opens, and where history ends. Defaults to the real today. */
  today?: number;
};

/** The network with some lines hidden, and the stretches of time each line left is out with them: what the engine is made from. */
export type ShownNetwork = {
  network: Network;
  /** The years each line was drawn as a line hidden (an alias), by line. */
  gaps: Map<LineId, LineGap[]>;
};

/** A network with the lines a person may show or hide, for a list to do it. */
export type NetworkChoice = {
  id: NetworkId;
  name: string;
  lines: { id: LineId; name: string; color: LineColor; shown: boolean }[];
};

/** The network at one moment: every question about it then. */
export type FactsAt = {
  /** The stations on the map, for a search: each with its names and its lines' colours. */
  stations: () => StationSummary[];
  /** A station's lines, with when each opened there and, if it has, closed. */
  station: (id: StationId) => StationInfo;
  /** A line's stops in order, by branch, its length, and the changes that made it. */
  line: (id: LineId) => LineDetails;
  /** The stations open longest, those most lines call at, and the longest lines: so many of each. */
  records: (count: number) => NetworkRecords;
  /** The ways between two stations, up to three, fastest first; none if there is none at this moment. */
  routes: (from: StationId, to: StationId) => RouteInfo[];
  /** How long it takes from a station to every other; `null` if no line calls there at this moment. */
  reach: (from: StationId) => ReachInfo | null;
  /** How many stations, km of track and lines are open. */
  stats: () => NetworkStats;
  /** The stops either side of a station, on each of its lines that calls there, by line. */
  directions: (station: StationId) => Map<LineId, LineDirection[]>;
};

/** A segment of track a reach colours, timed by its ends. */
export type ReachedSegment = { segment: number; minutes: number };

/** What the records are worked out from: the network, its history, and each line's colour. */
export type RecordsSource = {
  index: NetworkIndex;
  timeline: Timeline;
  /** The year each station was first on the map, by id. */
  firstYears: Map<StationId, number>;
  colorOf: (line: LineId) => LineColor;
};
