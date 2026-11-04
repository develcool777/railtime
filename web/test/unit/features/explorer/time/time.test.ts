import { planOnlyNetwork } from '@railtime/network/testing/planOnlyNetwork';
import { openExplorer } from '@test/support/factories/explorer.utils';
import { timeAt } from '@test/support/factories/timeState.utils';
import { standInMap } from '@test/support/factories/transitMap.utils';
import { describe, expect, test } from 'vitest';

import { useMapStore } from '~/features/explorer/map/map.store';
import { useNetworkStore } from '~/features/explorer/network.store';
import { useTimeStore } from '~/features/explorer/time/time.store';

/**
 * The explorer opened on an address, with a stand-in map handed to it as the map arrives.
 *
 * @param query - The address's query.
 * @returns The time store, and the commands the map has been given.
 */
const withMap = (query: Record<string, string> = {}) => {
  const explorer = openExplorer(query);
  const { map, commands } = standInMap();
  explorer.ATTACH(map);
  return { timeStore: useTimeStore(), commands };
};

describe('TimeStore', () => {
  test('sets playback as the address says, else as a page opens', () => {
    openExplorer({ speed: '4', minimap: 'off' });
    expect(useTimeStore().player).toEqual({ speed: 4, camera: 'follow', minimap: false });
    openExplorer();
    expect(useTimeStore().player).toEqual({ speed: 2, camera: 'follow', minimap: true });
  });

  test('takes the map where the address opened, or to the plan built, or leaves it at today', () => {
    expect(withMap({ at: '3' }).commands.map(command => command.name)).toEqual(['seek']);
    expect(withMap({ plan: 'extension' }).commands).toEqual([{ name: 'seek', args: [useNetworkStore().facts?.playheads.end()] }]);
    expect(withMap().commands).toEqual([]);
  });

  test('names where the history is as the address opened, until the map tells it', () => {
    const { timeStore } = withMap({ at: '3' });
    expect(timeStore.linkedPlayhead).toEqual({ cursor: 3, progress: 0 });
    timeStore.SET_TIME(timeAt({ cursor: 1, time: Date.UTC(1905, 0, 1), atToday: false, atRest: false }));
    expect(timeStore.linkedPlayhead?.cursor).toBe(1);
  });

  test('shows the player as it plays, and pauses only while the map moves in it', () => {
    const { timeStore, commands } = withMap();
    timeStore.PLAY();
    expect(timeStore.playerShown).toBe(true);
    // The map has not moved yet: playing again, not pausing.
    timeStore.TOGGLE_PLAY();
    timeStore.SET_TIME(timeAt({ playing: true }));
    timeStore.TOGGLE_PLAY();
    expect(timeStore.playerShown).toBe(false);
    expect(commands.map(command => command.name)).toEqual(['play', 'play', 'pause']);
  });

  test('steps a year on the timeline, a change in the player, and nothing in a network never built', () => {
    const { timeStore, commands } = withMap();
    timeStore.STEP_TIME(1);
    timeStore.PLAY();
    timeStore.STEP_TIME(1);
    timeStore.STEP_TIME(-1);
    expect(commands.map(command => command.name)).toEqual(['stepYear', 'play', 'skip', 'previousChange']);
    const explorer = openExplorer({}, planOnlyNetwork());
    const planOnly = standInMap();
    explorer.ATTACH(planOnly.map);
    useTimeStore().STEP_TIME(1);
    expect(planOnly.commands.map(command => command.name)).toEqual(['seek']);
  });

  test('leaves the player for a place, the map stopped first', () => {
    const { timeStore, commands } = withMap();
    timeStore.PLAY();
    timeStore.LEAVE_TO('today');
    expect(timeStore.playerShown).toBe(false);
    expect(commands.map(command => command.name)).toEqual(['play', 'stop', 'seek']);
    expect(useMapStore().map).not.toBeNull();
  });
});
