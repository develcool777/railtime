import type { LngLat } from '@railtime/core/geometry.types';
import type { NetworkEngine } from '@railtime/network/engine.service';
import type { FeatureCollection, HeadProperties, LineFeature, NetworkSnapshot, PointFeature, StationLines } from '../layers/snapshot.types';
import type { RenderState } from '../layers/style.types';
import type { ViewMode } from '../transitMap.types';

/** What a step animation knows about the network, fixed when it starts. */
export type StepContext = {
  index: NetworkEngine['index'];
  timeline: NetworkEngine['timeline'];
  /** How the map is seen as the step plays: a stretch grows more slowly followed up close in 3D. */
  view: ViewMode;
};

/** How fast a new stretch grows: its time is its length and its stations, never squeezed or stretched. */
export type GrowthPace = {
  /** Km a second the growth front runs at between stations, at 1×. */
  kmPerSecond: number;
  /** Seconds at 1× it takes to speed up from a stop to that pace, and to brake from it into one. */
  rampSeconds: number;
  /** Seconds at 1× the front stops at each new station, for it to be seen opening. */
  stationSeconds: number;
};

/** Where a camera following a growing line looks from, and the way it faces: from `behind` to `ahead`. */
export type ChaseTarget = { center: LngLat; behind: LngLat; ahead: LngLat };

/** One run of a growing stretch: from where the front left to where it next stops, or the end. */
export type GrowthMove = {
  fromKm: number;
  km: number;
  /** It ends at a new station, where the front waits. */
  stops: boolean;
};

/** One frame of a playing step. */
export type StepFrame = {
  state: RenderState;
  snapshot: NetworkSnapshot;
  /** How far through its drawing time the change is, linear: 0 before it starts drawing, 1 once drawn. Each kind eases it as it draws. */
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
  /** Station → opacity while it closes: labelled at any zoom, marked closed. */
  fading: Map<string, number>;
  /** Station → the name it had, while it takes a new one: labelled with both. */
  renamed: Map<string, string>;
  /** Transfers the step has linked so far, a station it reached to one on the map: drawn as the network's are. */
  links: FeatureCollection<LineFeature>;
  /** The stations at either end of those links: drawn as interchanges from then on. */
  linked: Set<string>;
  /** Where a camera following the line looks from this frame, and which way; `null` when nothing grows. */
  chase: ChaseTarget | null;
};
