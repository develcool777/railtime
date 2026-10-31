import type { LngLat } from '@railtime/core/geometry.types';

/** An outline as GeoJSON gives it: one polygon, or several. */
export type OutlineGeometry = { type: 'Polygon'; coordinates: LngLat[][] } | { type: 'MultiPolygon'; coordinates: LngLat[][][] };

/** What Nominatim's lookup gives for an OpenStreetMap relation, as far as an outline needs. */
export type NominatimPlace = {
  /** The relation's id. */
  osm_id: number;
  /** Its name in the local language. */
  name: string;
  /** Its names, by tag: `name:en` among them. */
  namedetails?: Record<string, string>;
  /** Its outline. */
  geojson: OutlineGeometry | { type: string };
};

/** What `pnpm data:boundary` was asked for. */
export type BoundaryArgs = {
  /** The city's id; none for every city. */
  city: string | undefined;
  /** The relation to fetch it from; none for the one its outline names. */
  relation: number | null;
};
