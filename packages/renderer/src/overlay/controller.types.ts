import type { CoverageLayer } from '../coverage/layer.service';
import type { NetworkFacts } from '@railtime/network/facts.service';
import type { NetworkTime } from '@railtime/network/facts.types';
import type { CameraDirector } from '../playback/camera.service';
import type { ReachLayer } from '../reach/layer.service';
import type { RouteLayer } from '../route/layer.service';
import type { Theme } from '@railtime/network/facts.types';
import type { OverlayResult } from '../transitMap.types';

/** What the overlay controller draws with, and where it reads the moment and theme. */
export type OverlayParts = {
  facts: NetworkFacts;
  route: Pick<RouteLayer, 'update' | 'shown'>;
  reach: Pick<ReachLayer, 'update' | 'shown'>;
  coverage: Pick<CoverageLayer, 'update'>;
  camera: Pick<CameraDirector, 'fit'>;
  /** The moment the map shows. */
  moment: () => NetworkTime;
  /** The theme it is drawn in. */
  theme: () => Theme;
  /** Says what the overlay came to. */
  report: (result: OverlayResult | null) => void;
};
