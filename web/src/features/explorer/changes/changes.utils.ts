import { yearOf } from '@railtime/core/date.utils';
import type { ChangeInfo } from '@railtime/network/facts.types';
import type { TimeState } from '@railtime/renderer/transitMap.types';
import type { ChangeGroup, ChangeRow, ChangeState } from '~/features/explorer/changes/changes.types';
import { decadeHeading } from '~/features/explorer/format.utils';
import { foldName } from '~/features/explorer/stations/station.utils';

/**
 * The changes under a heading for each decade, in order; a plan's last, under "Plan".
 *
 * @param changes - The timeline's changes, in order.
 * @returns Each decade with its changes.
 */
export const changesByDecade = (changes: ChangeInfo[]): ChangeGroup[] => {
  const groups: ChangeGroup[] = [];
  for (const change of changes) {
    const decade = decadeHeading(change.time);
    const group = groups.at(-1);
    if (group?.decade === decade) group.changes.push(change);
    else groups.push({ decade, changes: [change] });
  }
  return groups;
};

/**
 * The changes a search finds: each word typed in its title, what it names or its year ("victoria 1968").
 *
 * @param changes - The changes, in order.
 * @param query - What was typed.
 * @returns Those that match, in order; all of them for an empty query.
 */
export const findChanges = (changes: ChangeInfo[], query: string): ChangeInfo[] => {
  const words = foldName(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return changes;
  return changes.filter(change => {
    const text = foldName([change.title, change.subtitle ?? '', change.time === null ? 'plan' : String(yearOf(change.time))].join(' '));
    return words.every(word => text.includes(word));
  });
};

/**
 * The change the map is at: while playing, the one playing (or the last played between two);
 * otherwise the last of the year shown, if that year had one.
 *
 * @param changes - The timeline's changes, in order.
 * @param time - Where the map is.
 * @param stepPlaying - A change's step is playing now.
 * @returns Its position in the timeline, or `null` for none.
 */
export const currentChangeIndex = (changes: ChangeInfo[], time: TimeState | null, stepPlaying: boolean): number | null => {
  if (!time) return null;
  if (time.playing || stepPlaying) {
    const index = stepPlaying ? time.cursor : time.cursor - 1;
    return index >= 0 && index < changes.length ? index : null;
  }
  if (time.inPlan) return null;
  const year = yearOf(time.time);
  const ofYear = changes.filter(change => change.index < time.cursor && change.time !== null && yearOf(change.time) === year);
  return ofYear.at(-1)?.index ?? null;
};

/**
 * How a change's row is drawn against the current one: done once the map has passed it, active at
 * it, plain while it is still ahead or there is none.
 *
 * @param index - The change's position in the timeline.
 * @param current - The current change's position; `null` for none.
 * @returns Its state, as the timeline marks it.
 */
export const changeState = (index: number, current: number | null): ChangeState => {
  if (current === null || index > current) return undefined;
  return index === current ? 'active' : 'completed';
};

/**
 * The Changes list as rows, one a change: the first of each decade under its heading, the last of
 * each with no line on to the next.
 *
 * @param groups - The changes under their decades, in order.
 * @returns The rows, each with a key of its own.
 */
export const changeRows = (groups: ChangeGroup[]): ChangeRow[] =>
  groups.flatMap(({ decade, changes }) =>
    changes.map((change, position) => ({ key: String(change.index), change, decade, heading: position === 0, last: position === changes.length - 1 })),
  );
