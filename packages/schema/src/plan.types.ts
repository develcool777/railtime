import type { Network, Segment } from './network.types';

/** What one section of a plan builds. */
export type BuiltSection = {
  line: string;
  /** The segments the line runs over from this section on, by position in the built network's `segments`. */
  segments: number[];
  /** New stations it stands on track the line already ran over: they open on the line with it. */
  infills: string[];
};

/** A plan built on its network: the track it needs, and what each section opens, in order. Undated. */
export type BuiltPlan = {
  /**
   * The network with the plan's lines, stations and transfers, and its track: split where a new
   * station stands on it, new where there was none. The plan's lines are not on its segments:
   * `sections` say where they run. Without its plans.
   */
  network: Network;
  sections: BuiltSection[];
};

/** A section being built: its line, the segments it puts the line on, and its infill stations. */
export type SectionWorks = { line: string; segments: Segment[]; infills: string[] };
