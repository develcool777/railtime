/**
 * The index of every city's dataset: what a list of cities shows of each without loading its whole
 * network. It is written from the datasets, beside them.
 */
import type { LngLat } from './network.types';

/** A line as a list of cities shows it: its name and a swatch in each theme. */
export type IndexedLine = {
  id: string;
  name: string;
  color: string;
  darkColor: string;
};

/** A line's track as a city's picture draws it, simplified, in its colours: one path per segment. */
export type IndexedTrack = {
  color: string;
  darkColor: string;
  paths: LngLat[][];
};

/** One city, as the index sums it up. */
export type CityIndexEntry = {
  /** The city's name, as its dataset gives it. */
  name: string;
  /** Its country's folder, beside the city's own. */
  country: string;
  /** The brands its lines run under. */
  networks: string[];
  /** The year its first line opened, or `null` for a network never built. */
  openedYear: number | null;
  /** Nothing built: its lines, stations and track are its first plan's. */
  planOnly: boolean;
  /** How many futures it has. */
  plans: number;
  lines: IndexedLine[];
  stations: number;
  /** What is open today (or a network never built's first plan), by line, the one drawn on top last. */
  track: IndexedTrack[];
};

/** Every city, by the id of its folder. */
export type CityIndex = Record<string, CityIndexEntry>;
