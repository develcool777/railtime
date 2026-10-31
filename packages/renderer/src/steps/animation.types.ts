import type { NetworkIndex } from '@railtime/network/engine/index.service';
import type { Timeline } from '@railtime/network/engine/timeline.service';
import type { FeatureCollection, HeadProperties, LineFeature, PointFeature, StationLines } from '../layers/features.types';
import type { RenderState } from '../layers/lineStyle.types';
import type { NetworkSnapshot } from '../layers/snapshot.types';
import type { ViewMode } from '../transitMap.types';

/** What a step animation knows about the network, fixed when it starts. */
export type StepContext = {
  index: NetworkIndex;
  timeline: Timeline;
  /** How the map is seen as the step plays: a stretch grows more slowly followed up close in 3D. */
  view: ViewMode;
};

/** How fast a new stretch grows. */
export type GrowthPace = {
  /** Km a second, at 1×. */
  kmPerSecond: number;
  /** The shortest a stretch takes to draw, seconds at 1×: even a short one is seen. */
  minSeconds: number;
  /** The longest, seconds at 1×: a long one speeds up. */
  maxSeconds: number;
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
