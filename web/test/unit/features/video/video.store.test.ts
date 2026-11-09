import { keysOf } from '@railtime/core/collection.utils';
import { required } from '@railtime/core/required.utils';
import { AROUND_TINY } from '@railtime/network/testing/boundaries';
import { tinyNetwork } from '@railtime/network/testing/tinyNetwork';
import { createPinia, setActivePinia } from 'pinia';
import { describe, expect, test } from 'vitest';
import { timeAt } from '@test/support/factories/timeState.utils';
import { mapOnStandIn, standInMap } from '@test/support/factories/transitMap.utils';
import { SCENE_MS, WHOLE_FIT_MS } from '~/features/video/video.constants';
import { useVideoStore } from '~/features/video/video.store';

/** How long each scene that moves on by itself shows, ms. */
const { title: TITLE_MS = 0, insights: INSIGHTS_MS = 0, overview: OVERVIEW_MS = 0, end: END_MS = 0 } = SCENE_MS;

describe('VideoStore', () => {
  /** The test network's outline, served as a fetch reads one. */
  const OUTLINE = `data:application/json,${encodeURIComponent(JSON.stringify(AROUND_TINY))}`;

  /**
   * A video opened on a network, its map made and ready, its outline come.
   *
   * @param network - The city's network.
   * @param plan - The plan its address names; `null` for none.
   * @returns The store, and the commands its map was given.
   */
  const readyVideo = async (network = tinyNetwork(), plan: string | null = null) => {
    setActivePinia(createPinia());
    const store = useVideoStore();
    store.OPEN({ network, size: { width: 1920, height: 1080 }, viewMode: '3d', outline: OUTLINE, plan });
    const { map, commands } = standInMap();
    store.ATTACH(map);
    store.MAP_READY();
    await expect.poll(() => store.outlineSettled).toBe(true);
    return { store, commands };
  };

  test("is ready once its map is, at the history's start, and once its outline has come", async () => {
    const { store, commands } = await readyVideo();
    expect(store.scene).toBe('ready');
    expect(store.pageState).toBe('ready');
    expect(store.boundary).toEqual(AROUND_TINY);
    expect(commands.filter(command => command.name !== 'update')).toEqual([{ name: 'seek', args: [store.facts?.playheads.start()] }]);
  });

  /**
   * A video played up to the end of its history.
   *
   * @param network - The city's network.
   * @param plan - The plan its address names; `null` for none.
   * @returns The store, and the commands its map was given.
   */
  const pastHistory = async (network = tinyNetwork(), plan: string | null = null) => {
    const video = await readyVideo(network, plan);
    video.store.START();
    video.store.TICK(TITLE_MS);
    video.store.END_PLAYBACK();
    return video;
  };

  test('plays the history, the whole network, its numbers, and ends on them, playing no plan unless asked', async () => {
    const { store, commands } = await readyVideo();
    store.START();
    store.TICK(TITLE_MS);
    expect(store.scene).toBe('history');
    expect(commands.at(-1)).toEqual({ name: 'play', args: [store.facts?.playheads.start()] });

    store.END_PLAYBACK();
    expect(store.scene).toBe('overview');
    expect(store.mapProps).toMatchObject({ facts: store.facts, viewMode: '2d', overlay: null });
    expect(commands.slice(-2)).toEqual([
      { name: 'update', args: [store.mapProps] },
      { name: 'fitNetwork', args: [WHOLE_FIT_MS] },
    ]);

    let clock = TITLE_MS + OVERVIEW_MS;
    store.TICK(clock);
    expect(store.scene).toBe('insights');
    expect(store.mapProps).toMatchObject({ facts: store.facts, viewMode: '2d', overlay: { kind: 'coverage' } });
    expect(commands.at(-1)).toEqual({ name: 'fitNetwork', args: [WHOLE_FIT_MS] });

    clock += INSIGHTS_MS;
    store.TICK(clock);
    expect(store.scene).toBe('end');
    expect(store.insights?.stats).toEqual(store.facts?.today().stats());
    store.TICK(clock + END_MS);
    expect(store.pageState).toBe('done');
    expect(store.planFacts).toBeNull();
  });

  test('goes on past its numbers to the plan its address names, whatever its status, on its own network, and ends on it built', async () => {
    const network = tinyNetwork();
    const named = keysOf(network.plans ?? {})[0] ?? null;
    for (const plan of Object.values(network.plans ?? {})) plan.status = 'concept';
    const { store, commands } = await pastHistory(network, named);
    store.TICK(TITLE_MS + OVERVIEW_MS);
    store.TICK(TITLE_MS + OVERVIEW_MS + INSIGHTS_MS);
    expect(store.scene).toBe('plan');
    expect(store.plan?.id).toBe(named);
    expect(store.mapProps).toMatchObject({ facts: store.planFacts, viewMode: '3d', overlay: null });
    const laid = store.planFacts;
    expect(commands.slice(-2)).toEqual([
      { name: 'update', args: [store.mapProps] },
      { name: 'play', args: [laid?.playheads.start()] },
    ]);
    store.END_PLAYBACK();
    expect(store.scene).toBe('overview');
    expect(store.planFacts).toBe(laid);
    expect(store.mapProps).toMatchObject({ facts: laid, viewMode: '2d', overlay: null });
    expect(store.planGain).toBeNull();
    store.TICK(TITLE_MS + OVERVIEW_MS + INSIGHTS_MS + OVERVIEW_MS);
    expect(store.scene).toBe('end');
    expect(store.mapProps).toMatchObject({ boldPlans: true });
    expect(store.planGain?.map(gain => gain.label)).toContain('Stations');
    expect(commands.at(-1)).toEqual({ name: 'fitNetwork', args: [WHOLE_FIT_MS] });
  });

  test("plays the plan on the plan's own network, on the map itself, as its beat starts: no flush between", async () => {
    const network = tinyNetwork();
    const named = keysOf(network.plans ?? {})[0] ?? null;
    setActivePinia(createPinia());
    const store = useVideoStore();
    // No outline, so no coverage to paint on a canvas this test has not got.
    store.OPEN({ network, size: { width: 1920, height: 1080 }, viewMode: '2d', outline: 'http://127.0.0.1:9/outline.json', plan: named });
    const { map, frame, ready } = mapOnStandIn(required(store.mapProps ?? undefined, 'the props'), { time: time => store.SET_TIME(time) });
    store.ATTACH(map);
    ready();
    store.MAP_READY();
    await expect.poll(() => store.outlineSettled).toBe(true);
    store.START();
    store.TICK(TITLE_MS);
    store.END_PLAYBACK();
    store.TICK(TITLE_MS + OVERVIEW_MS);
    store.TICK(TITLE_MS + OVERVIEW_MS + INSIGHTS_MS);
    expect(store.scene).toBe('plan');
    frame();
    expect(store.time).toMatchObject({ cursor: store.planFacts?.playheads.start().cursor, playing: true, atRest: false });
  });

  test('keeps where the history is, as the map tells it, for the year card to count to', async () => {
    const { store } = await readyVideo();
    const state = timeAt({ stats: { stations: 3, km: 7.6, lines: 1 } });
    store.SET_TIME(state);
    expect(store.time).toBe(state);
  });

  test('lays the plan on by the beat alone, once for the beats that share it, and takes it off with the network', async () => {
    const network = tinyNetwork();
    const named = keysOf(network.plans ?? {})[0] ?? null;
    const { store } = await readyVideo(network, named);
    const planned = store.script.findIndex(beat => beat.plan);
    expect(store.planFacts).toBeNull();
    store.beatIndex = planned;
    const laid = store.planFacts;
    expect(laid?.plan).toBe(named);
    store.beatIndex = planned + 1;
    expect(store.planFacts).toBe(laid);
    store.beatIndex = planned - 1;
    expect(store.planFacts).toBeNull();
    store.beatIndex = planned;
    store.RESET();
    expect(store.planFacts).toBeNull();
  });

  test("gives the panels' charts the same numbers every frame, so none is drawn again", async () => {
    const { store } = await pastHistory();
    store.TICK(TITLE_MS + OVERVIEW_MS);
    const series = store.insights?.stationYears;
    expect(series?.length).toBeGreaterThan(0);
    store.TICK(TITLE_MS + OVERVIEW_MS + 1000);
    expect(store.insights?.stationYears).toBe(series);
  });

  test("counts the end card's numbers from its scene's start, and rests on them after", async () => {
    const { store } = await pastHistory();
    expect(store.endCounted).toBe(Infinity);
    for (let second = 0; second < 40 && store.scene !== 'end'; second++) store.TICK(store.now + 1000);
    expect(store.scene).toBe('end');
    expect(store.endCounted).toBeLessThan(1000);
    store.TICK(store.now + (SCENE_MS.end ?? 0));
    expect(store.endCounted).toBe(Infinity);
  });

  test('takes a plan the network does not have for none named', async () => {
    const { store } = await readyVideo(tinyNetwork(), 'nowhere');
    expect(store.script.filter(beat => beat.plan)).toEqual([]);
  });

  test('has numbers only while the panels show', async () => {
    const { store } = await pastHistory();
    expect(store.insights).toBeNull();
    store.TICK(TITLE_MS + OVERVIEW_MS);
    expect(store.insights?.stats).toEqual(store.facts?.today().stats());
  });

  test('takes the map being ready once, and no end of playback outside the history or a plan', async () => {
    const { store } = await readyVideo();
    store.MAP_READY();
    store.END_PLAYBACK();
    expect(store.scene).toBe('ready');
  });
});
