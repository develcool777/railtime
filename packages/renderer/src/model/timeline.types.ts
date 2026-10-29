import type { LineSegment, TrackSegment } from './networkIndex.types';

/** What every step has. */
type StepBase = {
  /** Position in the timeline; also the cursor at which the step plays. */
  index: number;
  /** The step's date, as a UTC midnight timestamp. */
  time: number;
};

/** A connected stretch of one (effective) line opens. */
export type OpenStep = StepBase & { kind: 'open'; line: string; lineSegments: LineSegment[]; segments: TrackSegment[] };

/** One line's sections close. */
export type CloseStep = StepBase & { kind: 'close'; line: string; lineSegments: LineSegment[] };

/** A station opens on track its lines already run over. */
export type InfillStep = StepBase & { kind: 'infill'; station: string; lines: string[] };

/** Lines stop being drawn as another line (Hammersmith & City leaving the Metropolitan, the Overground splitting). */
export type IdentityStep = StepBase & { kind: 'identity'; lines: string[]; text: string };

/**
 * One thing that happens, played on its own. Several steps can share a date: they play one after
 * another while the clock waits on that date.
 */
export type Step = OpenStep | CloseStep | InfillStep | IdentityStep;

/** A step before the timeline numbers it. */
export type StepDraft = Omit<OpenStep, 'index'> | Omit<CloseStep, 'index'> | Omit<InfillStep, 'index'> | Omit<IdentityStep, 'index'>;

/** What a line is drawn as at a cursor: its own id or an alias's. `previousId` is set mid-way through an identity change. */
export type LineIdentity = { id: string; previousId?: string };

/** Everything that happens on one date, before it is cut into steps. */
export type DayChanges = {
  opens: LineSegment[];
  closes: LineSegment[];
  infills: { station: string; line: string }[];
  identities: { line: string; text: string }[];
};

/** The step at which a line stops being drawn as `as`. */
export type AliasEnd = { step: number; as: string };
