import type { MapView } from '@railtime/renderer/transitMap.types';

/** A line as a city card shows it: a swatch in each theme. */
type SummaryLine = {
  id: string;
  name: string;
  color: string;
  darkColor: string;
};

/** What a city card says about a network. */
export type CitySummary = {
  lines: SummaryLine[];
  stations: number;
  /** The brands its lines run under ("Underground", "Overground"). */
  networks: string[];
  /** The year its first line opened, or `null` for a network never built. */
  openedYear: number | null;
  /** Nothing built: its lines and stations are its first plan's. */
  planOnly: boolean;
  /** How many futures it has. */
  plans: number;
};

/** One segment of a network sketch, as an SVG path in each theme's colour. */
type PreviewPath = {
  path: string;
  color: string;
  darkColor: string;
};

/** A preview's size, in CSS pixels. */
export type PreviewSize = { width: number; height: number };

/** A network drawn small: where its picture of the basemap looks, and its track over it. */
export type Preview = { view: MapView; paths: PreviewPath[] };

/** The landing page's search and filters. */
export type CityFilter = {
  /** Matched against the city's name, country and networks. */
  query: string;
  /** One country, or every one (empty). */
  country: string;
  /** Cities with a history to play, never built, or both. */
  kind: 'all' | 'history' | 'never-built';
  /** Only cities with plans. */
  withPlans: boolean;
};
