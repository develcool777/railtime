import type { ChangeInfo } from '@railtime/network/facts.types';
import { FUTURE_SHARE, MAX_TICK_LEVEL, TIMELINE_LABEL_YEARS } from '~/features/explorer/time/time.constants';
import { yearOf } from '~/features/explorer/format.utils';
import type { TimelineLabel, TimelineScale, TimelineTarget, TimelineTick } from '~/features/explorer/time/timeline.types';

/**
 * The share of the width the dates take: all of it, or what the Future zone leaves.
 *
 * @param scale - The timeline's scale.
 * @returns A fraction.
 */
const datedShare = (scale: TimelineScale): number => (scale.plannedCount > 0 ? 1 - FUTURE_SHARE : 1);

/**
 * Where a date sits.
 *
 * @param scale - The timeline's scale.
 * @param time - A timestamp.
 * @returns A fraction of the width, clamped to the dates' share.
 */
export const positionOf = (scale: TimelineScale, time: number): number => {
  const span = Math.max(1, scale.end - scale.start);
  return Math.min(1, Math.max(0, (time - scale.start) / span)) * datedShare(scale);
};

/**
 * Where the thumb sits: on the date, or in the Future zone, past the plan's changes built so far.
 *
 * @param scale - The timeline's scale.
 * @param time - The clock.
 * @param cursor - Changes played so far.
 * @param future - Whether the map shows the plan's future.
 * @returns A fraction of the width.
 */
export const thumbPosition = (scale: TimelineScale, time: number, cursor: number, future: boolean): number => {
  if (!future || scale.plannedCount === 0) return positionOf(scale, time);
  const built = Math.min(scale.plannedCount, Math.max(0, cursor - scale.datedCount));
  return 1 - FUTURE_SHARE + (FUTURE_SHARE * built) / scale.plannedCount;
};

/**
 * One mark per change but renames: a dated one on its date, stacked over others of its year; a
 * planned one where the thumb stands once it is built.
 *
 * @param scale - The timeline's scale.
 * @param changes - Every change, in timeline order.
 * @returns The marks.
 */
export const timelineTicks = (scale: TimelineScale, changes: ChangeInfo[]): TimelineTick[] => {
  const perYear = new Map<number, number>();
  return changes
    .filter(change => change.kind !== 'rename')
    .map(change => {
      if (change.time === null) {
        const built = change.index - scale.datedCount + 1;
        const left = 1 - FUTURE_SHARE + (FUTURE_SHARE * built) / Math.max(1, scale.plannedCount);
        return { index: change.index, left, level: 0, color: change.color, closure: false, label: `Future · ${change.title}` };
      }
      const year = yearOf(change.time);
      const level = perYear.get(year) ?? 0;
      perYear.set(year, level + 1);
      const closure = change.kind === 'close' || change.kind === 'stationClose';
      return {
        index: change.index,
        left: positionOf(scale, change.time),
        level: Math.min(level, MAX_TICK_LEVEL),
        color: change.color,
        closure,
        label: `${year} · ${change.title}`,
      };
    });
};

/**
 * The years written under the timeline: the first, each round year between, and "Today" at the end.
 *
 * @param scale - The timeline's scale.
 * @returns The labels, left to right.
 */
export const timelineLabels = (scale: TimelineScale): TimelineLabel[] => {
  const first = yearOf(scale.start);
  const last = yearOf(scale.end);
  const share = datedShare(scale);
  const labels: TimelineLabel[] = [{ text: String(first), left: 0, today: false }];
  for (let year = Math.ceil((first + 1) / TIMELINE_LABEL_YEARS) * TIMELINE_LABEL_YEARS; year < last; year += TIMELINE_LABEL_YEARS) {
    const left = positionOf(scale, Date.UTC(year, 0, 1));
    // Kept clear of the ends' labels.
    if (left > 0.1 * share && left < 0.92 * share) labels.push({ text: String(year), left, today: false });
  }
  labels.push({ text: 'Today', left: share, today: true });
  return labels;
};

/**
 * What a point on the timeline stands for: a date, or in the Future zone the plan built to the
 * nearest of its changes, all of them at the right end.
 *
 * @param scale - The timeline's scale.
 * @param fraction - Where, as a fraction of the width.
 * @returns The date or change to show.
 */
export const targetAt = (scale: TimelineScale, fraction: number): TimelineTarget => {
  const share = datedShare(scale);
  if (scale.plannedCount > 0 && fraction > share) {
    const built = Math.round(((fraction - share) / FUTURE_SHARE) * scale.plannedCount);
    if (built >= scale.plannedCount) return { kind: 'future' };
    if (built > 0) return { kind: 'change', index: scale.datedCount + built - 1 };
    return { kind: 'date', time: scale.end };
  }
  return { kind: 'date', time: scale.start + (Math.min(Math.max(fraction, 0), share) / share) * (scale.end - scale.start) };
};
