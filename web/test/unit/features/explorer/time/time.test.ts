import { planOnlyNetwork } from '@railtime/network/testing/planOnlyNetwork';
import { arrivalTimeOf } from '@railtime/renderer/transitMap.utils';
import { describe, expect, test } from 'vitest';
import { openExplorer } from '@test/support/factories/explorer.utils';
import { timeAt } from '@test/support/factories/timeState.utils';
import { standInMap } from '@test/support/factories/transitMap.utils';
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
  openExplorer(query);
  const { map, commands } = standInMap();
  useMapStore().ATTACH(map);
  return { timeStore: useTimeStore(), commands };
};

describe('TimeStore', () => {
  test('sets playback as the address says, else as a page opens', () => {
    openExplorer({ speed: '4', minimap: 'off' });
    expect(useTimeStore().player).toEqual({ speed: 4, camera: 'follow', minimap: false });
    openExplorer();
    expect(useTimeStore().player).toEqual({ speed: 2, camera: 'follow', minimap: true });
  });

  test('says where the map stands on the network it opens on, as the address opened or at rest, and gives it no command', () => {
    expect(withMap({ at: '1935-06-01' }).timeStore.arrival).toEqual({ day: Date.UTC(1935, 5, 1) });
    expect(withMap({ plan: 'extension' }).timeStore.arrival).toBeNull();
    expect(withMap().commands).toEqual([]);
  });

  test("reads another network from the moment it is given it: the map's next frame's time, nothing of the last network's", () => {
    const { timeStore } = withMap();
    timeStore.SET_TIME(timeAt({ cursor: 3 }));
    timeStore.SET_STEP(useNetworkStore().changes[2] ?? null);
    const day = Date.UTC(1935, 5, 1);
    timeStore.ARRIVE({ day });
    const facts = useNetworkStore().facts;
    expect(timeStore.arrival).toEqual({ day });
    expect(timeStore.time).toEqual(facts && arrivalTimeOf(facts, { day }));
    expect(timeStore.step).toBeNull();
  });

  test('knows history has played out from when the map says, until it plays again', () => {
    const { timeStore } = withMap();
    expect(timeStore.playedOut).toBe(false);
    timeStore.END_PLAYBACK();
    expect(timeStore.playedOut).toBe(true);
    timeStore.PLAY();
    expect(timeStore.playedOut).toBe(false);
  });

  test('is where the address asks from the moment a page opens, before the map is there to say so', () => {
    openExplorer({ at: '1935-06-01' });
    const facts = useNetworkStore().facts;
    expect(useTimeStore().time).toEqual(facts && arrivalTimeOf(facts, { day: Date.UTC(1935, 5, 1) }));
    openExplorer();
    expect(useTimeStore().time).toMatchObject({ atRest: true, atToday: true, playing: false });
  });

  test('names where the history is as the address opened, and then as the map tells it', () => {
    const { timeStore } = withMap({ at: '1935-06-01' });
    expect(timeStore.linkedMoment).toEqual({ day: Date.UTC(1935, 5, 1) });
    timeStore.SET_TIME(timeAt({ cursor: 1, time: Date.UTC(1905, 0, 1), atToday: false, atRest: false }));
    expect(timeStore.linkedMoment).toEqual({ day: Date.UTC(1905, 0, 1) });
  });

  test('shows the player while the map says it plays, and the timeline as soon as it says it does not', () => {
    const { timeStore } = withMap();
    expect(timeStore.timeMode).toBe('timeline');
    timeStore.SET_TIME(timeAt({ playing: true }));
    expect(timeStore.timeMode).toBe('playing');
    expect(timeStore.playerShown).toBe(true);
    // Playback reached its end, or another network is drawn at its today: the map says so, nothing else.
    timeStore.SET_TIME(timeAt({ playing: false }));
    expect(timeStore.timeMode).toBe('timeline');
  });

  test('plays, and pauses only while the map plays', () => {
    const { timeStore, commands } = withMap();
    timeStore.TOGGLE_PLAY();
    // The map has not moved yet: playing again, not pausing.
    timeStore.TOGGLE_PLAY();
    timeStore.SET_TIME(timeAt({ playing: true }));
    timeStore.TOGGLE_PLAY();
    expect(commands.map(command => command.name)).toEqual(['play', 'play', 'pause']);
  });

  test('steps a year on the timeline, a change in the player, and nothing in a network never built', () => {
    const { timeStore, commands } = withMap();
    timeStore.STEP_TIME(1);
    timeStore.SET_TIME(timeAt({ playing: true }));
    timeStore.STEP_TIME(1);
    timeStore.STEP_TIME(-1);
    expect(commands.map(command => command.name)).toEqual(['stepYear', 'skip', 'previousChange']);
    openExplorer({}, planOnlyNetwork());
    const planOnly = standInMap();
    useMapStore().ATTACH(planOnly.map);
    useTimeStore().STEP_TIME(1);
    expect(planOnly.commands).toEqual([]);
  });

  test('leaves the player for a place, the map stopped first', () => {
    const { timeStore, commands } = withMap();
    timeStore.SET_TIME(timeAt({ playing: true }));
    timeStore.LEAVE_TO('today');
    expect(commands.map(command => command.name)).toEqual(['stop', 'seek']);
    expect(useMapStore().map).not.toBeNull();
  });
});
