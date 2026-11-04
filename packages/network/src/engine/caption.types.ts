import type { LineId } from '@railtime/schema/network.types';
import type { NetworkIndex } from './index.service';
import type { Timeline } from './timeline.service';
import type { LineColor } from '../facts/facts.types';

/** What a change's caption is worked out from: the network, its timeline, and its lines' colours. */
export type CaptionContext = {
  index: NetworkIndex;
  timeline: Timeline;
  /** A line's own colour. */
  colorOf: (line: LineId) => LineColor;
};
