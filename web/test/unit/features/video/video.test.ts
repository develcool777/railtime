import { keysOf } from '@railtime/core/collection.utils';
import { COVERAGE_DEFAULT_METRES } from '@railtime/network/coverage.constants';
import type { NetworkFacts } from '@railtime/network/facts.service';
import type { ChangeInfo, PlanInfo } from '@railtime/network/facts.types';
import { AROUND_TINY } from '@railtime/network/testing/boundaries';
import { tinyNetwork } from '@railtime/network/testing/tinyNetwork';
import type { TimeState } from '@railtime/renderer/transitMap.types';
import type { PlanStatus } from '@railtime/schema/network.types';
import { planId } from '@railtime/schema/testing/ids';
import { createPinia, setActivePinia } from 'pinia';
import { describe, expect, test } from 'vitest';
import { nextTick } from 'vue';
import { standInMap } from '@test/support/factories/transitMap.utils';
import { COUNT_MS } from '~/constants/count.constants';
import { FADE_MS, PLAN_INTRO_MS, SCENE_MS, VIDEO_SPEED, WHOLE_FIT_MS } from '~/features/video/video.constants';
import { useVideoStore } from '~/features/video/video.store';
import {
  historySpan,
  pageStateOf,
  sameSizes,
  sceneEnded,
  shownFor,
  spokenAddress,
  videoLayersOf,
  videoMapPropsOf,
  videoPaddingOf,
  videoPlanAskedOf,
  videoPlanOf,
  videoScriptOf,
  videoViewOf,
} from '~/features/video/video.utils';

/**
 * A change on a date, or a planned one.
 *
 * @param date - Its date, or `null` for a planned change.
 * @returns The change.
 */
const changeOn = (date: string | null) => ({ time: date === null ? null : Date.parse(date) }) as ChangeInfo;

/**
 * A plan of a status, as the network gives it.
 *
 * @param id - Its id.
 * @param status - How far it has got.
 * @returns The plan.
 */
const planOf = (id: string, status: PlanStatus): PlanInfo => ({ id: planId(id), name: id, status, facts: { stations: 0, km: 0, lines: [] } });

/** How long each scene that moves on by itself shows, ms. */
const { title: TITLE_MS = 0, insights: INSIGHTS_MS = 0, overview: OVERVIEW_MS = 0, end: END_MS = 0 } = SCENE_MS;

describe('VideoUtils', () => {
  describe('videoScriptOf', () => {
    const plan = planOf('later', 'concept');

    test('ends on today: the history, the whole network, its numbers, the end card over them', () => {
      const script = videoScriptOf(null);
      expect(script.map(beat => beat.scene)).toEqual(['ready', 'title', 'history', 'overview', 'insights', 'end', 'done']);
      expect(script.slice(3).map(beat => beat.framing)).toEqual(['whole', 'insights', 'insights', 'insights']);
      expect(script.map(beat => beat.plan)).toEqual(script.map(() => null));
    });

    test('goes on past its numbers with a plan, and ends on it built, flat', () => {
      const script = videoScriptOf(plan);
      expect(script.slice(4).map(beat => beat.scene)).toEqual(['insights', 'plan', 'overview', 'end', 'done']);
      expect(script.slice(5).map(beat => beat.plan)).toEqual([plan, plan, plan, plan]);
      expect(script.slice(-3).map(beat => beat.framing)).toEqual(['whole', 'ending', 'ending']);
    });
  });

  describe('sceneEnded', () => {
    test('ends the title, the numbers, the overview and the end card as their time runs out', () => {
      expect(sceneEnded('title', TITLE_MS - 1)).toBe(false);
      expect(sceneEnded('title', TITLE_MS)).toBe(true);
      expect(sceneEnded('insights', INSIGHTS_MS)).toBe(true);
      expect(sceneEnded('overview', OVERVIEW_MS)).toBe(true);
      expect(sceneEnded('end', END_MS)).toBe(true);
    });

    test('leaves the history and a plan to their playback, and a video not started, or over, as it is', () => {
      for (const scene of ['history', 'plan', 'ready', 'done'] as const) expect(sceneEnded(scene, 10 * 60_000)).toBe(false);
    });
  });

  describe('videoPlanOf', () => {
    const plans = [planOf('now', 'under-construction'), planOf('idea', 'concept')];

    test('plays the plan its address names, whatever its status', () => {
      expect(videoPlanOf(plans, false, 'idea')?.name).toBe('idea');
    });

    test('plays none unless asked, nor one the network does not have', () => {
      expect(videoPlanOf(plans, false, null)).toBeNull();
      expect(videoPlanOf(plans, false, 'nowhere')).toBeNull();
    });

    test('plays none after a network never built, whose history is its plan', () => {
      expect(videoPlanOf(plans, true, 'idea')).toBeNull();
    });
  });

  describe('shownFor', () => {
    test('fades in at the start, holds, and fades out at the end', () => {
      expect(shownFor(0, 4000, 500)).toBe(0);
      expect(shownFor(250, 4000, 500)).toBe(0.5);
      expect(shownFor(2000, 4000, 500)).toBe(1);
      expect(shownFor(3750, 4000, 500)).toBe(0.5);
      expect(shownFor(4000, 4000, 500)).toBe(0);
    });
  });

  describe('historySpan', () => {
    test("spans its first change's year to its last's, leaving planned changes out", () => {
      expect(historySpan([changeOn('1960-11-06'), changeOn('1976-12-17'), changeOn('2023-01-01'), changeOn(null)])).toBe('1960 – 2023');
    });

    test('names the one year of a history in one year, and nothing for none', () => {
      expect(historySpan([changeOn('1960-11-06'), changeOn('1960-12-01')])).toBe('1960');
      expect(historySpan([changeOn(null)])).toBe('');
    });
  });

  describe('videoPaddingOf', () => {
    test('keeps room for the year above and the caption below, more below, in proportion to the size', () => {
      expect(videoPaddingOf({ width: 1920, height: 1080 }, 'playing')).toEqual({ top: 173, bottom: 281, left: 154, right: 154 });
      expect(videoPaddingOf({ width: 1080, height: 1920 }, 'playing').bottom).toBe(499);
    });

    test("keeps a plan's end card clear down one side, the network given the rest", () => {
      const { left, right, top } = videoPaddingOf({ width: 1920, height: 1080 }, 'ending');
      expect(left).toBeGreaterThan(right);
      expect(top).toBeLessThan(videoPaddingOf({ width: 1920, height: 1080 }, 'whole').top);
    });
  });

  describe('pageStateOf', () => {
    test('tells a recorder loading, ready and over as they are, and every scene between as playing', () => {
      expect(pageStateOf('loading', true)).toBe('loading');
      expect(pageStateOf('ready', true)).toBe('ready');
      expect(['title', 'history', 'planTitle', 'plan', 'overview', 'end'].map(scene => pageStateOf(scene as 'title', true))).toEqual(
        Array.from({ length: 6 }, () => 'playing'),
      );
      expect(pageStateOf('done', true)).toBe('done');
    });

    test("is not ready while the city's outline is still coming: its coverage would miss the take", () => {
      expect(pageStateOf('ready', false)).toBe('loading');
    });
  });

  describe('videoLayersOf', () => {
    const still = { planned: false, elapsed: 0, sinceCaption: 0, sinceCaptionGone: null };

    test('shows the title over its scene alone, fading in and out', () => {
      expect(videoLayersOf({ ...still, scene: 'title', elapsed: TITLE_MS / 2 }).title).toBe(1);
      expect(videoLayersOf({ ...still, scene: 'title', elapsed: TITLE_MS }).title).toBe(0);
      expect(videoLayersOf({ ...still, scene: 'history', elapsed: TITLE_MS / 2 }).title).toBe(0);
    });

    test('names the plan as it starts to play, fading in and out, and not after', () => {
      expect(videoLayersOf({ ...still, scene: 'plan', elapsed: PLAN_INTRO_MS / 2 }).planIntro).toBe(1);
      expect(videoLayersOf({ ...still, scene: 'plan', elapsed: PLAN_INTRO_MS }).planIntro).toBe(0);
      expect(videoLayersOf({ ...still, scene: 'overview', elapsed: PLAN_INTRO_MS / 2 }).planIntro).toBe(0);
    });

    test('shows the minimap while the history and the plan play, and takes it out as the whole network comes', () => {
      expect(videoLayersOf({ ...still, scene: 'history', elapsed: FADE_MS / 2 }).minimap).toBe(0.5);
      expect(videoLayersOf({ ...still, scene: 'plan', elapsed: FADE_MS }).minimap).toBe(1);
      expect(videoLayersOf({ ...still, scene: 'overview', elapsed: FADE_MS / 2 }).minimap).toBe(0.5);
      expect(videoLayersOf({ ...still, scene: 'overview', elapsed: FADE_MS }).minimap).toBe(0);
      expect(['title', 'insights', 'end'].map(scene => videoLayersOf({ ...still, scene: scene as 'end' }).minimap)).toEqual([0, 0, 0]);
    });

    test('brings the year in with the history and keeps it to the end, the end card fading in beside it', () => {
      expect(videoLayersOf({ ...still, scene: 'history', elapsed: FADE_MS / 2 }).year).toBe(0.5);
      expect(['insights', 'plan', 'overview', 'end', 'done'].map(scene => videoLayersOf({ ...still, scene: scene as 'plan' }).year)).toEqual([1, 1, 1, 1, 1]);
      expect(videoLayersOf({ ...still, scene: 'overview' }).end).toBe(0);
      expect(videoLayersOf({ ...still, scene: 'end', elapsed: FADE_MS / 2 }).end).toBe(0.5);
      expect(videoLayersOf({ ...still, scene: 'end', elapsed: FADE_MS }).end).toBe(1);
      expect(videoLayersOf({ ...still, scene: 'done' }).end).toBe(1);
    });

    test("takes the year card out as a plan's end card comes, which says all it does", () => {
      const planned = { ...still, planned: true };
      expect(videoLayersOf({ ...planned, scene: 'overview' }).year).toBe(1);
      expect(videoLayersOf({ ...planned, scene: 'end', elapsed: FADE_MS / 2 }).year).toBe(0.5);
      expect(videoLayersOf({ ...planned, scene: 'end', elapsed: FADE_MS }).year).toBe(0);
      expect(videoLayersOf({ ...planned, scene: 'done' }).year).toBe(0);
    });

    test('takes the totals out as the panels come, which say them, and brings them back as a plan plays', () => {
      expect(videoLayersOf({ ...still, scene: 'overview' }).totals).toBe(1);
      expect(videoLayersOf({ ...still, scene: 'insights', elapsed: FADE_MS / 2 }).totals).toBe(0.5);
      expect(videoLayersOf({ ...still, scene: 'insights', elapsed: FADE_MS }).totals).toBe(0);
      expect(['end', 'done'].map(scene => videoLayersOf({ ...still, scene: scene as 'end' }).totals)).toEqual([0, 0]);
      expect(videoLayersOf({ ...still, planned: true, scene: 'plan', elapsed: FADE_MS / 2 }).totals).toBe(0.5);
    });

    test("keeps the totals whole as a plan's end card comes, for the card to fade as one", () => {
      expect(videoLayersOf({ ...still, planned: true, scene: 'end', elapsed: FADE_MS / 2 }).totals).toBe(1);
    });

    test('fades a caption in as its change starts and out once it goes, never more than the year', () => {
      const playing = { scene: 'history' as const, planned: false, elapsed: 10_000 };
      expect(videoLayersOf({ ...playing, sinceCaption: FADE_MS / 2, sinceCaptionGone: null }).caption).toBe(0.5);
      expect(videoLayersOf({ ...playing, sinceCaption: 5000, sinceCaptionGone: null }).caption).toBe(1);
      expect(videoLayersOf({ ...playing, sinceCaption: 5000, sinceCaptionGone: FADE_MS }).caption).toBe(0);
      expect(videoLayersOf({ ...playing, elapsed: FADE_MS / 4, sinceCaption: 5000, sinceCaptionGone: null }).caption).toBe(0.25);
    });
  });

  describe('videoMapPropsOf', () => {
    const facts = {} as NetworkFacts;
    const size = { width: 1920, height: 1080 };
    const input = { facts, size, viewMode: '3d' as const, boundary: AROUND_TINY };

    test("shows the network dark, seen as asked while it plays, at the video's pace, without street names, framing clear of what lies over it", () => {
      expect(videoMapPropsOf({ ...input, framing: 'playing' })).toEqual({
        facts,
        theme: 'dark',
        viewMode: '3d',
        overlay: null,
        boundary: AROUND_TINY,
        speed: VIDEO_SPEED,
        streetLabels: false,
        boldPlans: false,
        padding: videoPaddingOf(size, 'playing'),
      });
    });

    test("lies flat between the panels, the city's coverage drawn within its outline, where it has one", () => {
      expect(videoMapPropsOf({ ...input, framing: 'insights' })).toMatchObject({
        viewMode: '2d',
        overlay: { kind: 'coverage', metres: COVERAGE_DEFAULT_METRES },
        padding: videoPaddingOf(size, 'insights'),
      });
      expect(videoMapPropsOf({ ...input, framing: 'insights', boundary: null }).overlay).toBeNull();
    });

    test('lies flat for the whole network, nothing drawn over its lines', () => {
      expect(videoMapPropsOf({ ...input, framing: 'whole' })).toMatchObject({
        viewMode: '2d',
        overlay: null,
        boldPlans: false,
        padding: videoPaddingOf(size, 'whole'),
      });
    });

    test('draws a plan bold beside its end card, flat, clear of it', () => {
      expect(videoMapPropsOf({ ...input, framing: 'ending' })).toMatchObject({
        viewMode: '2d',
        overlay: null,
        boldPlans: true,
        padding: videoPaddingOf(size, 'ending'),
      });
    });
  });

  describe('sameSizes', () => {
    const sizes = { stations: 3, km: 4, lines: 1, year: 1995 };

    test('says whether what the year card counts matches', () => {
      expect(sameSizes(sizes, { ...sizes })).toBe(true);
      expect(sameSizes(sizes, { ...sizes, stations: 4 })).toBe(false);
      expect(sameSizes(sizes, { ...sizes, km: 5 })).toBe(false);
      expect(sameSizes(sizes, { ...sizes, lines: 2 })).toBe(false);
      expect(sameSizes(sizes, { ...sizes, year: 1996 })).toBe(false);
    });
  });

  describe('videoViewOf', () => {
    test('sees the video in 3D, unless its address asks for flat', () => {
      expect(videoViewOf(undefined)).toBe('3d');
      expect(videoViewOf('3d')).toBe('3d');
      expect(videoViewOf('2d')).toBe('2d');
    });
  });

  describe('videoPlanAskedOf', () => {
    test('reads the plan an address names, and none for none, or one repeated', () => {
      expect(videoPlanAskedOf('kept')).toBe('kept');
      expect(videoPlanAskedOf(undefined)).toBeNull();
      expect(videoPlanAskedOf(['kept', 'other'])).toBeNull();
    });
  });

  describe('spokenAddress', () => {
    test('says an address without its scheme or its last slash', () => {
      expect(spokenAddress('https://develcool777.github.io/railtime/')).toBe('develcool777.github.io/railtime');
      expect(spokenAddress('http://localhost:5180/')).toBe('localhost:5180');
    });
  });
});

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
    expect(commands).toEqual([{ name: 'seek', args: [store.facts?.playheads.start()] }]);
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
    await nextTick();
    expect(commands.at(-1)).toEqual({ name: 'fitNetwork', args: [WHOLE_FIT_MS] });

    let clock = TITLE_MS + OVERVIEW_MS;
    store.TICK(clock);
    expect(store.scene).toBe('insights');
    expect(store.mapProps).toMatchObject({ facts: store.facts, viewMode: '2d', overlay: { kind: 'coverage' } });
    await nextTick();
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
    expect(commands.at(-1)?.name).not.toBe('play');
    await nextTick();
    expect(commands.at(-1)).toEqual({ name: 'play', args: [laid?.playheads.start()] });
    store.END_PLAYBACK();
    expect(store.scene).toBe('overview');
    expect(store.planFacts).toBe(laid);
    expect(store.mapProps).toMatchObject({ facts: laid, viewMode: '2d', overlay: null });
    expect(store.planGain).toBeNull();
    store.TICK(TITLE_MS + OVERVIEW_MS + INSIGHTS_MS + OVERVIEW_MS);
    expect(store.scene).toBe('end');
    expect(store.mapProps).toMatchObject({ boldPlans: true });
    expect(store.planGain?.map(gain => gain.label)).toContain('Stations');
    await nextTick();
    expect(commands.at(-1)).toEqual({ name: 'fitNetwork', args: [WHOLE_FIT_MS] });
  });

  test('counts the numbers on to a change, from where they are, and rests on them', async () => {
    const { store } = await readyVideo();
    const withStations = (stations: number) => ({ time: Date.UTC(1995, 0, 1), stats: { stations, km: 0, lines: 1 } }) as TimeState;
    store.SET_TIME(withStations(10));
    store.TICK(COUNT_MS);
    expect(store.counts.stations.now).toBe(10);
    store.SET_TIME(withStations(20));
    expect(store.counts.stations.now).toBe(10);
    store.TICK(COUNT_MS + COUNT_MS / 2);
    expect(store.counts.stations.now).toBeGreaterThan(10);
    expect(store.counts.stations.now).toBeLessThan(20);
    store.TICK(COUNT_MS * 2);
    expect(store.counts.stations.now).toBe(20);
  });

  test('counts on as a change is drawn, only as it changes a whole number', async () => {
    const { store } = await readyVideo();
    const withKm = (km: number) => ({ time: Date.UTC(1995, 0, 1), stats: { stations: 1, km, lines: 1 } }) as TimeState;
    store.SET_TIME(withKm(7.2));
    const started = store.countedAt;
    store.TICK(100);
    store.SET_TIME(withKm(7.4));
    expect(store.countedAt).toBe(started);
    store.SET_TIME(withKm(7.6));
    expect(store.countedAt).toBe(100);
  });

  test('starts the year where it is first told, and counts it on from there', async () => {
    const { store } = await readyVideo();
    const inYear = (year: number) => ({ time: Date.UTC(year, 0, 1), stats: { stations: 1, km: 0, lines: 1 } }) as TimeState;
    store.SET_TIME(inYear(1960));
    expect(store.counts.year.now).toBe(1960);
    store.SET_TIME(inYear(1970));
    store.TICK(COUNT_MS / 2);
    expect(store.counts.year.now).toBeGreaterThan(1960);
    expect(store.counts.year.now).toBeLessThan(1970);
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
