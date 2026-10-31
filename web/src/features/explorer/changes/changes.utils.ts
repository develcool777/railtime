import type { ChangeInfo } from '@railtime/network/facts.types';
import type { TimeState } from '@railtime/renderer/transitMap.types';

import { yearOf } from '@railtime/core/date.utils';

import { decadeHeading } from '~/features/explorer/format.utils';
import type { ChangeGroup } from '~/features/explorer/changes/changes.types';

/**
 * The changes under a heading for each decade, in order; a plan's last, under "Future".
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
  if (time.future) return null;
  const year = yearOf(time.time);
  const ofYear = changes.filter(change => change.index < time.cursor && change.time !== null && yearOf(change.time) === year);
  return ofYear.at(-1)?.index ?? null;
};

/**
 * Where a run of changes stands against the current one, as a timeline's position: the current
 * change's place in it; past its end when every change in it came before (all done); none when the
 * current one is still ahead, or there is none.
 *
 * @param indices - The run's changes, by their position in the timeline, in order.
 * @param current - The current change's position; `null` for none.
 * @returns The position to mark active: `-1` for none, `indices.length` for all done.
 */
export const timelinePosition = (indices: number[], current: number | null): number => {
  if (current === null) return -1;
  const here = indices.indexOf(current);
  if (here !== -1) return here;
  const last = indices.at(-1);
  return last !== undefined && last < current ? indices.length : -1;
};
