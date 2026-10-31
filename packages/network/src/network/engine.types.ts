import type { LngLat } from '@railtime/core/geometry.types';

// The raw network as the renderer sees it (`NetworkEngine`): its track, the lines over it, the steps
// its history plays, and how an opening grows.

/** Direction of travel along a segment: 1 from station A to B, -1 from B to A. */
export type Travel = 1 | -1;

/** Track between two adjacent stations, with its geometry prepared for drawing part of it in either direction. */
export type TrackSegment = {
  /** Position in the network's segment list: a stable id. */
  index: number;
  stationA: string;
  stationB: string;
  /** From station A to station B. */
  coordinates: LngLat[];
  /** From station B to station A. */
  reversedCoordinates: LngLat[];
  /** Distance along `coordinates` to each point, km. */
  distances: number[];
  /** Distance along `reversedCoordinates` to each point, km. */
  reversedDistances: number[];
  lengthKm: number;
  /** The segment's direction along its route, consistent with its neighbours': see `orientation.utils.ts`. */
  travel: Travel;
};

/** One line running over one segment for one period, with its dates as timestamps. */
export type LineSegment = {
  segment: TrackSegment;
  line: string;
  /** When it opens; `Infinity` for a plan's, which has no date. */
  opens: number;
  closes: number | null;
  /** The plan section that opens it, or `null` for a dated one. */
  section: number | null;
  /** The line's period here before this one, when it was suspended in between. */
  previous: LineSegment | null;
  /** The line's period here after this one, when it returned. */
  next: LineSegment | null;
};

/** What every step has. */
type StepBase = {
  /** Position in the timeline; also the cursor at which the step plays. */
  index: number;
  /** The step's date, as a UTC midnight timestamp; `Infinity` for a planned step, which has none. */
  time: number;
  /** It builds a plan's section: after every dated step, in the plan's order. */
  planned: boolean;
};

/** A connected stretch of one (effective) line opens. */
export type OpenStep = StepBase & { kind: 'open'; line: string; lineSegments: LineSegment[]; segments: TrackSegment[] };

/** One line's sections close. */
export type CloseStep = StepBase & { kind: 'close'; line: string; lineSegments: LineSegment[] };

/** A station opens on track its lines already run over. */
export type InfillStep = StepBase & { kind: 'infill'; station: string; lines: string[] };

/** Lines stop calling at a station while still running through it. */
export type StationCloseStep = StepBase & { kind: 'stationClose'; station: string; lines: string[] };

/** A station takes a new name. */
export type RenameStep = StepBase & { kind: 'rename'; station: string; from: string; to: string };

/** Lines stop being drawn as another line (a branch becoming its own line, one line splitting into several). */
export type IdentityStep = StepBase & { kind: 'identity'; lines: string[]; text: string };

/**
 * One thing that happens, played on its own. Several steps can share a date: they play one after
 * another while the clock waits on that date.
 */
export type Step = OpenStep | CloseStep | InfillStep | StationCloseStep | RenameStep | IdentityStep;

/** How one segment of a growing stretch draws. */
export type SegmentPlan = {
  segment: TrackSegment;
  /** Draws from station A towards B (else from B towards A). */
  fromStationA: boolean;
  /** How far the growth front has travelled, km, when this segment starts drawing. */
  startKm: number;
};

/** How a stretch of new track grows. */
export type Growth = {
  plans: SegmentPlan[];
  /** How far the growth front travels in all. */
  totalKm: number;
  /** Every station of the stretch in the order the front reaches it; `isNew` if it was not on the map before. */
  reach: { station: string; km: number; isNew: boolean }[];
};
