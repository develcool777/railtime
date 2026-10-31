import type { IsoDate } from '@railtime/schema/network.types';
import type { DecadeOpenings as ModelDecadeOpenings, YearStats as ModelYearStats } from '../network/history.types';
import type { Step } from '../network/timeline.types';
import type { RoutePreference as ModelRoutePreference } from '../route/finder.types';

/** The map's colour theme. */
export type Theme = 'dark' | 'light';

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
  color: string;
  /** Stations this step opens, in the order they appear. */
  stations: string[];
};

/** One change in the timeline, for a list of changes: its caption and where it plays. */
export type ChangeInfo = StepInfo & {
  /** Its position in the timeline: what `showChange` and `playFrom` take. */
  index: number;
};

/** One line at a station, for a station panel. */
export type StationLineInfo = {
  id: string;
  name: string;
  color: string;
  /** When it opened here; `null` for a plan's line, which has no date. */
  opened: IsoDate | null;
  closed?: IsoDate;
};

/** A station, for a station panel. */
export type StationInfo = {
  id: string;
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
export type TransferInfo = { id: string; name: string; lines: { id: string; name: string; color: string }[] };

/** A line, for a legend or toggles. */
export type LineInfo = {
  id: string;
  name: string;
  network: string;
  networkName: string;
  color: string;
  /** When it first opened, as a timestamp; `null` for a line only a plan builds. */
  opened: number | null;
};

/** A station as a search lists it: on the map on the date shown. */
export type StationSummary = {
  id: string;
  /** Its name on the date shown. */
  name: string;
  /** That name in the network's other languages. */
  otherNames: string[];
  /** The colours of the lines that call there, in line order. */
  colors: string[];
};

/** A stop on a line, for a line's panel. */
export type LineStop = { id: string; name: string };

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
  branches: LineStop[][];
  /** The changes that are part of its story, by their position in the timeline (`ChangeInfo.index`). */
  changes: number[];
};

/** What a route is best at: arriving soonest, or changing least, if it takes a little longer. */
export type RoutePreference = ModelRoutePreference;

/** A station on a route. */
export type RouteStop = { id: string; name: string };

/** One part of a route: a ride on a line from where it is boarded to where it is left, or a walk between two stations. */
export type RouteLegInfo =
  | {
      kind: 'ride';
      line: string;
      lineName: string;
      color: string;
      /** Its stops, from the one boarded at to the one left at. */
      stops: RouteStop[];
      minutes: number;
      km: number;
    }
  | { kind: 'walk'; from: RouteStop; to: RouteStop; minutes: number };

/** How to get from one station to another on the date shown. */
export type RouteInfo = {
  from: RouteStop;
  to: RouteStop;
  legs: RouteLegInfo[];
  /** About how long it takes, changes and walks included. */
  minutes: number;
  /** How far it rides. */
  km: number;
  /** How many times it changes line. */
  changes: number;
  /** The track it rides, by segment: what a route overlay draws. */
  segments: number[][];
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
export type ReachStation = { id: string; name: string; minutes: number; band: number };

/** How far one can get from a station on the date shown, and how long it takes. */
export type ReachInfo = {
  from: RouteStop;
  /** Every other station reached, soonest first. */
  stations: ReachStation[];
  /** The bands its stations are coloured in, soonest first. */
  bands: ReachBand[];
};

/** A band of walking distance to the nearest station, nearest first. */
export type CoverageBand = {
  /** The most metres in it. */
  upTo: number;
  /** "400–800 m". */
  label: string;
  color: string;
};

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
  metres: number;
  /** The share of the city within `metres` of a station, 0..1. */
  share: number;
  /** Each band, nearest first. */
  bands: CoverageShare[];
  /** What lies farther than every band. */
  beyond: { share: number; km2: number };
};

/** The share of a city within the headline distance of a station at the end of a year. */
export type CoverageYear = { year: number; share: number };

/** The network at the end of one year. */
export type YearStats = ModelYearStats;

/** How many stations first opened in a decade. */
export type DecadeOpenings = ModelDecadeOpenings;

/** The network year by year, and how many stations opened in each decade. Plans have no date and are not in it. */
export type NetworkGrowth = { years: YearStats[]; decades: DecadeOpenings[] };

/** The network's records on the date shown, each list longest or oldest first. */
export type NetworkRecords = {
  /** The stations open longest, with the year each first opened. */
  oldest: { id: string; name: string; year: number }[];
  /** The stations most lines call at. */
  busiest: { id: string; name: string; lines: { id: string; name: string; color: string }[] }[];
  /** The longest lines. */
  longest: { id: string; name: string; color: string; km: number }[];
};

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

/** What a plan would add to its network, for its card. */
export type PlanFacts = {
  /** Its new stations. */
  stations: number;
  /** Its new track, km. */
  km: number;
  /** The lines its sections build on, in the order they first come, with their colours in each theme. */
  lines: { id: string; name: string; color: string; darkColor: string }[];
};
