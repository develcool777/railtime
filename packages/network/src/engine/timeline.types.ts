import type { CloseStep, IdentityStep, InfillStep, LineSegment, OpenStep, RenameStep, StationCloseStep } from './engine.types';

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
