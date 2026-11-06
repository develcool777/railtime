import type { NetworkEngine } from '@railtime/network/engine.service';
import type { LineId } from '@railtime/schema/network.types';
import type { BaseNetwork } from '../steps/animation.types';

/** Everything that decides how a line looks in a frame. */
export type RenderState = {
  index: NetworkEngine['index'];
  timeline: NetworkEngine['timeline'];
  cursor: number;
  /** What the step playing asks of the network under it, at its phase. */
  base: BaseNetwork;
  /** A line's own colour in the current theme. */
  baseColor: (line: LineId) => string;
};

/** A line as drawn: the id it is drawn as and its colour now. */
export type ResolvedLine = { id: LineId; color: string };

/** Per segment index, the (effective) lines on it in side-by-side order. */
export type SideBySide = Map<number, LineId[]>;
