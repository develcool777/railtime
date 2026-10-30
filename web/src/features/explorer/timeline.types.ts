/** How a timeline maps the network's changes onto its width. */
export type TimelineScale = {
  /** The first date, as a timestamp: the left end. */
  start: number;
  /** The last date: today, or a later dated change. */
  end: number;
  /** Changes with a date, which come first. */
  datedCount: number;
  /** A plan's changes, after the dated ones: they share the Future zone at the right. */
  plannedCount: number;
};

/** A mark on the timeline for one change. */
export type TimelineTick = {
  /** The change's position in the timeline. */
  index: number;
  /** Where it sits, as a fraction of the width. */
  left: number;
  /** How many marks of the same year sit under it. */
  level: number;
  color: string;
  /** A closure: a small grey mark. */
  closure: boolean;
  /** "1907 · Aldwych branch opened", for its tooltip. */
  label: string;
};

/** A year written under the timeline. */
export type TimelineLabel = { text: string; left: number; today: boolean };

/** What a point on the timeline stands for. */
export type TimelineTarget = { kind: 'date'; time: number } | { kind: 'change'; index: number } | { kind: 'future' };
