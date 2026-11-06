import type { NetworkIndex } from './index.service';
import type { Timeline } from './timeline.service';

/** What a change's caption is worked out from: the network and its timeline. */
export type CaptionContext = {
  index: NetworkIndex;
  timeline: Timeline;
};
