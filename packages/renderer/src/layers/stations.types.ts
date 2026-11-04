import type { StationId } from '@railtime/schema/network.types';
import type { StationLines } from './snapshot.types';

/** Everything the station layer needs for one frame. */
export type StationFrame = {
  /** Frame time, from `requestAnimationFrame`. */
  now: number;
  /** Stations on the map this frame and the lines serving them. */
  stations: Map<StationId, StationLines>;
  /** Stations with a transfer to another on the map: drawn as interchanges. */
  linked: Set<StationId>;
  /** Stations only planned track reaches: drawn hollow. */
  planned: Set<StationId>;
  /** Stations opening in the playing step. */
  highlighted: Set<StationId>;
  /** Station → opacity while it closes. */
  fading: Map<StationId, number>;
  /** Station → the name it had, while it is renamed. */
  renamed: Map<StationId, string>;
  /** Stations closing for a spell, or reopening after one, in the step playing. */
  spells: Set<StationId>;
  /** Opacity of new stations' labels: fades out at the end of their step. */
  newLabelOpacity: number;
  /** Show every station at once, with no pop-in (after a jump in time, a toggle or a theme change). */
  instant: boolean;
  /** A step is playing: a station pulses at most once per step. */
  stepPlaying: boolean;
};
