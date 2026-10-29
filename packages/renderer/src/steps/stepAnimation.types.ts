import type { NetworkIndex } from '../model/networkIndex.service';
import type { Timeline } from '../model/timeline.service';
import type { FeatureCollection, HeadProperties, LineFeature, PointFeature, StationLines } from '../layers/features.types';
import type { RenderState } from '../layers/lineStyle.types';
import type { NetworkSnapshot } from '../layers/networkSnapshot.types';

/** What a step animation knows about the network, fixed when it starts. */
export type StepContext = {
  index: NetworkIndex;
  timeline: Timeline;
  /** Stations on the map just before the step. */
  stationsBefore: Set<string>;
};

/** One frame of a playing step. */
export type StepFrame = {
  state: RenderState;
  snapshot: NetworkSnapshot;
  /** How far the change has animated, eased: 0 before it starts drawing, 1 once drawn. */
  progress: number;
  /** How far the highlight has faded after drawing, 0..1. */
  holdProgress: number;
};

/** What a playing step adds to the map in one frame. */
export type StepDrawing = {
  lines: FeatureCollection<LineFeature>;
  heads: FeatureCollection<PointFeature<HeadProperties>>;
  /** Stations the step has reached so far, with the lines it adds to them. */
  reached: Map<string, StationLines>;
  /** Stations new in this step: pulse and label them. */
  highlighted: Set<string>;
  /** Station → opacity while it closes. */
  fading: Map<string, number>;
};
