/** When a line calls at a station on its track, where that is not simply while it runs there. */
export type StopSteps = {
  /** The step the station opens on it at (`infill`); -1 for from the start. */
  opens: number;
  /** The step it stops calling at (`closed`); `Infinity` for never. */
  closes: number;
  /** It never calls there: the station opened after it left, closed before it came, or it passes. */
  never: boolean;
  /** Spells it does not call while it runs there (`suspended`): the step each closes at, and the one it reopens at, `Infinity` until known. */
  spells: { closes: number; reopens: number }[];
};
