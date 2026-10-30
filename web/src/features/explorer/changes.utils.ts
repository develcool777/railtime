import type { ChangeInfo, TimeState } from '@railtime/renderer/transitMap.types';

import { decadeOf, yearOf } from '~/features/explorer/format.utils';
import type { ChangeGroup } from '~/features/explorer/changes.types';

/**
 * The changes under a heading for each decade, in order; a plan's last, under "Future".
 *
 * @param changes - The timeline's changes, in order.
 * @returns Each decade with its changes.
 */
export const changesByDecade = (changes: ChangeInfo[]): ChangeGroup[] => {
  const groups: ChangeGroup[] = [];
  for (const change of changes) {
    const decade = decadeOf(change.time);
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
