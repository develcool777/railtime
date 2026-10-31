import type { LngLat } from '@railtime/core/geometry.types';

/**
 * A city's outline: the area its network serves, as the city draws its limits. Kept beside its
 * dataset, `<city>.boundary.json`; what the Coverage section measures.
 */
export type CityBoundary = {
  /** What the outline is: "Greater London", "Kharkiv". */
  name: string;
  /** Where it comes from, as credited: "© OpenStreetMap contributors, relation 175342". */
  source: string;
  /** Its polygons: each an outer ring, then any holes, each ring closed (its last point its first). */
  polygons: LngLat[][][];
};
