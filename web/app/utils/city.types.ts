import type { MapView } from '@railtime/renderer/transitMap.types';

/** A line's track in a network sketch, as an SVG path in each theme's colour. */
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
