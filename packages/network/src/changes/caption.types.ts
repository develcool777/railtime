import type { LineColor } from '../facts/facts.types';
import type { NetworkIndex } from '../network/index.service';
import type { Timeline } from '../network/timeline.service';

/** What a change's caption is worked out from: the network, its timeline, and its lines' colours. */
export type CaptionContext = {
  index: NetworkIndex;
  timeline: Timeline;
  /** A line's own colour. */
  colorOf: (line: string) => LineColor;
};
