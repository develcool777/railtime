import type { LngLat } from '@railtime/schema/network.types';

/** Minimal GeoJSON, so the renderer needs no @types/geojson. */
type Feature<Geometry, Properties> = { type: 'Feature'; properties: Properties; geometry: Geometry };

/** A GeoJSON feature collection. */
export type FeatureCollection<Item> = { type: 'FeatureCollection'; features: Item[] };

/** Properties of a drawn line. */
type LineProperties = {
  color: string;
  /** Side-by-side slot on shared track: …-1, -0.5, 0, 0.5, 1… (see `lineStyle.utils.ts`). */
  offset: number;
  /** 1 for new track while its step plays, fading to 0. Draws it wider. */
  highlight: number;
};

/** A drawn line. */
export type LineFeature = Feature<{ type: 'LineString'; coordinates: LngLat[] }, LineProperties>;

/** A stretch of a route: ridden on a line, in its colour, or walked between two stations. */
export type RouteFeature = Feature<{ type: 'LineString'; coordinates: LngLat[] }, { color: string; walk: boolean }>;

/** A drawn point. */
export type PointFeature<Properties> = Feature<{ type: 'Point'; coordinates: LngLat }, Properties>;

/** Properties of a station dot. */
export type StationProperties = {
  id: string;
  name: string;
  /** Pop-in scale, 0 → 1 (overshoots a little on the way). */
  scale: number;
  opacity: number;
  /** A new station's label fades at the end of its step while the dot stays. */
  labelOpacity: number;
  /** Served by more than one (effective) line. */
  interchange: boolean;
  color: string;
  /** Opened in the step playing now: pulses, and is labelled at any zoom. */
  highlighted: boolean;
  /** Only planned track reaches it: drawn hollow. */
  planned: boolean;
};

/** Properties of a pulse ring around a new station. */
export type PulseProperties = { color: string; radius: number; opacity: number };

/** Properties of the glowing dot at a growing line's tip. */
export type HeadProperties = { color: string };

/** The lines serving a station: effective line id to colour. */
export type StationLines = Map<string, string>;
