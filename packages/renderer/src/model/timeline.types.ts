import type { LineSegment, TrackSegment } from './networkIndex.types';

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

/** A step before the timeline numbers it, and marks it planned by its time. */
export type StepDraft =
  | Omit<OpenStep, 'index' | 'planned'>
  | Omit<CloseStep, 'index' | 'planned'>
  | Omit<InfillStep, 'index' | 'planned'>
  | Omit<StationCloseStep, 'index' | 'planned'>
  | Omit<RenameStep, 'index' | 'planned'>
  | Omit<IdentityStep, 'index' | 'planned'>;

/** What a line is drawn as at a cursor: its own id or an alias's. `previousId` is set mid-way through an identity change. */
export type LineIdentity = { id: string; previousId?: string };

/** Everything that happens on one date, before it is cut into steps. */
export type DayChanges = {
  opens: LineSegment[];
  closes: LineSegment[];
  infills: { station: string; line: string }[];
  stationCloses: { station: string; line: string }[];
  renames: { station: string; from: string; to: string }[];
  identities: { line: string; text: string }[];
};

/** The step at which a line stops being drawn as `as`. */
export type AliasEnd = { step: number; as: string };
