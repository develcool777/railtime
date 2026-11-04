import type { CoverageMeasure } from '@railtime/network/coverage.service';
import type { NetworkFacts } from '@railtime/network/facts.service';
import type { CoverageDistance, Playhead, ReachInfo, RouteInfo, Theme } from '@railtime/network/facts.types';
import type { CoverageLayer } from './coverage.service';
import type { ReachLayer } from './reach.service';
import type { RouteLayer } from './route.service';
import type { CameraDirector } from '../playback/camera.service';
import type { OverlayResult } from '../transitMap.types';

/** What the overlay controller draws with, and where it reads the moment and theme. */
export type OverlayParts = {
  facts: NetworkFacts;
  route: Pick<RouteLayer, 'update' | 'shown'>;
  reach: Pick<ReachLayer, 'update' | 'shown'>;
  coverage: Pick<CoverageLayer, 'update'>;
  camera: Pick<CameraDirector, 'fit'>;
  /** The moment the map shows. */
  moment: () => Playhead;
  /** The theme it is drawn in. */
  theme: () => Theme;
  /** Says what the overlay came to. */
  report: (result: OverlayResult | null) => void;
};

/** What an overlay asked for comes to at a moment: a route's ways and the one shown, a reach, or coverage. */
export type OverlayDrawing = {
  /** A route's every way on the date; none for another overlay. */
  routes: RouteInfo[];
  /** The way shown: the option asked for, or the last there is on the date; `null` for none. */
  shown: number | null;
  /** That way, drawn. */
  route: RouteInfo | null;
  /** Where a reach gets to; `null` for none. */
  reach: ReachInfo | null;
  /** Coverage, measured within the distance asked for, once the outline is in; `null` for none. */
  coverage: { measure: CoverageMeasure; metres: CoverageDistance } | null;
};
