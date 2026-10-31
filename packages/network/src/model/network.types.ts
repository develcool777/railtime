import type { LineDetails, LineDirection, NetworkRecords, ReachInfo, RouteInfo, RoutePreference, StationInfo, StationSummary } from './facts.types';

/** A moment in the network's history, as the map's `time` event gives it: the steps happened, and the day. */
export type NetworkTime = {
  /** Steps that have happened. */
  cursor: number;
  /** The day, as a UTC timestamp. */
  time: number;
};

/** What a `NetworkModel` is made with besides the network. */
export type NetworkModelOptions = {
  /** One of the network's plans, built on it: its sections play after every dated change. */
  plan?: string;
  /** Today, as a UTC timestamp at midnight: where the map opens, and where history ends. Defaults to the real today. */
  today?: number;
};

/** The network at one moment, in one theme's colours: every question about it then. */
export type NetworkAt = {
  /** The stations on the map, for a search: each with its names and its lines' colours. */
  stations: () => StationSummary[];
  /** A station's lines, with when each opened there and, if it has, closed. */
  station: (id: string) => StationInfo;
  /** A line's stops in order, by branch, its length, and the changes that made it. */
  line: (id: string) => LineDetails;
  /** The stations open longest, those most lines call at, and the longest lines: so many of each. */
  records: (count: number) => NetworkRecords;
  /** The best route between two stations; `null` if there is none at this moment. */
  route: (from: string, to: string, preference: RoutePreference) => RouteInfo | null;
  /** How long it takes from a station to every other; `null` if no line calls there at this moment. */
  reach: (from: string) => ReachInfo | null;
  /** The stops either side of a station, on each of its lines that calls there, by line. */
  directions: (station: string) => Map<string, LineDirection[]>;
};

/** A moment as the model's own questions take it: the steps happened, the day (for names), and the theme's colours. */
export type NetworkMoment = {
  /** Steps that have happened. */
  cursor: number;
  /** The day, as a timestamp: names are the ones stations had then. */
  clock: number;
  /** A line's own colour in the theme asked for. */
  colorOf: (line: string) => string;
};
