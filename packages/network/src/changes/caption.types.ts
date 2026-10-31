import type { NetworkIndex } from '../network/index.service';
import type { Timeline } from '../network/timeline.service';

/** What a change's caption is worked out from: the network, its timeline, and the theme's colours. */
export type CaptionContext = {
  index: NetworkIndex;
  timeline: Timeline;
  /** A line's own colour in the theme asked for. */
  colorOf: (line: string) => string;
};
