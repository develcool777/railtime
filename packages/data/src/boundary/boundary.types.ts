import type { LngLat } from '@railtime/schema/network.types';

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
