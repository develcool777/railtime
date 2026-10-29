import type { NetworkStats } from '../transitMap.types';
import type { FeatureCollection, LineFeature, StationLines } from './features.types';
import type { SideBySide } from './lineStyle.types';

/** Everything already on the map at a cursor. Rebuilt only when the cursor, toggles or theme change. */
export type NetworkSnapshot = {
  sideBySide: SideBySide;
  lines: FeatureCollection<LineFeature>;
  /** Closed track, drawn dashed. */
  ghosts: FeatureCollection<LineFeature>;
  /** Stations on the map and the lines serving them. */
  stations: Map<string, StationLines>;
  /** Transfers with both stations on the map: a link between their dots. */
  transfers: FeatureCollection<LineFeature>;
  /** Stations on the map with a transfer to another on the map: drawn as interchanges. */
  linked: Set<string>;
  /** Stations all of whose lines are closing in the step playing now: they fade out with it. */
  closingOnly: Set<string>;
  stats: NetworkStats;
};
