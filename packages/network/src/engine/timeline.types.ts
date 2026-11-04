import type { LineId, StationId } from '@railtime/schema/network.types';
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
export type LineIdentity = { id: LineId; previousId?: LineId };

/** Everything that happens on one date, before it is cut into steps. */
export type DayChanges = {
  opens: LineSegment[];
  closes: LineSegment[];
  /** Stations opening on a line, `reopening` after a spell closed. */
  infills: { station: StationId; line: LineId; reopening: boolean }[];
  /** Stations closing on a line, `temporary` for a spell. */
  stationCloses: { station: StationId; line: LineId; temporary: boolean }[];
  renames: { station: StationId; from: string; to: string }[];
  identities: { line: LineId; text: string }[];
};

/** The step at which a line stops being drawn as `as`. */
export type AliasEnd = { step: number; as: LineId };
