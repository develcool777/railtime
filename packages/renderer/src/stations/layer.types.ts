import type { StationLines } from '../layers/features.types';

/** Everything the station layer needs for one frame. */
export type StationFrame = {
  /** Frame time, from `requestAnimationFrame`. */
  now: number;
  /** Stations on the map this frame and the lines serving them. */
  stations: Map<string, StationLines>;
  /** Stations with a transfer to another on the map: drawn as interchanges. */
  linked: Set<string>;
  /** Stations only planned track reaches: drawn hollow. */
  planned: Set<string>;
  /** Stations opening in the playing step. */
  highlighted: Set<string>;
  /** Station → opacity while it closes. */
  fading: Map<string, number>;
  /** Opacity of new stations' labels: fades out at the end of their step. */
  newLabelOpacity: number;
  /** Show every station at once, with no pop-in (after a jump in time, a toggle or a theme change). */
  instant: boolean;
  /** A step is playing: a station pulses at most once per step. */
  stepPlaying: boolean;
};
