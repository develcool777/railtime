import type { NetworkEngine } from '@railtime/network/engine.service';

/** Everything that decides how a line looks in a frame. */
export type RenderState = {
  index: NetworkEngine['index'];
  timeline: NetworkEngine['timeline'];
  cursor: number;
  /** How far the identity step at the cursor has played (0..1), or `null` when none is playing. */
  identityProgress: number | null;
  /** Lines the user has toggled on. */
  visibleLines: Set<string>;
  /** A line's own colour in the current theme. */
  baseColor: (line: string) => string;
};

/** A line as drawn: the id it is drawn as and its colour now. */
export type ResolvedLine = { id: string; color: string };

/** Per segment index, the (effective) lines on it in side-by-side order. */
export type SideBySide = Map<number, string[]>;
