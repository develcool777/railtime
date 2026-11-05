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
import { END_MS, FADE_MS, OVERVIEW_MS, PLAN_TITLE_MS, TITLE_MS, VIDEO_SPEED } from '~/features/video/video.constants';
import { useVideoStore } from '~/features/video/video.store';
import {
  fadedIn,
  historySpan,
  isOverview,
  pageStateOf,
  sceneAfter,
  sceneAfterPlayback,
  shownFor,
  spokenAddress,
  videoLayersOf,
  videoMapPropsOf,
  videoPaddingOf,
  videoPlansOf,
  videoViewOf,
  videoYearOf,
} from '~/features/video/video.utils';

/**
 * A change on a date, or a planned one.
 *
 * @param date - Its date, or `null` for a planned change.
 * @returns The change.
 */
const changeOn = (date: string | null) => ({ time: date === null ? null : Date.parse(date) }) as ChangeInfo;

describe('VideoUtils', () => {
  describe('sceneAfter', () => {
    test("moves the title, a plan's card, the overview and the end card on, as their time runs out", () => {
      expect(sceneAfter('title', TITLE_MS - 1)).toBe('title');
      expect(sceneAfter('title', TITLE_MS)).toBe('history');
      expect(sceneAfter('planTitle', PLAN_TITLE_MS)).toBe('plan');
      expect(sceneAfter('overview', OVERVIEW_MS - 1)).toBe('overview');
      expect(sceneAfter('overview', OVERVIEW_MS)).toBe('end');
      expect(sceneAfter('end', END_MS - 1)).toBe('end');
      expect(sceneAfter('end', END_MS)).toBe('done');
    });

    test('leaves the history and a plan to their playback, and a video not started, or over, as it is', () => {
      expect(sceneAfter('history', 10 * 60_000)).toBe('history');
      expect(sceneAfter('plan', 10 * 60_000)).toBe('plan');
      expect(sceneAfter('ready', 10 * 60_000)).toBe('ready');
      expect(sceneAfter('done', 10 * 60_000)).toBe('done');
    });
  });

  describe('sceneAfterPlayback', () => {
    test("moves on to the next plan's card, or, with none left, the whole network from above", () => {
      expect(sceneAfterPlayback(true)).toBe('planTitle');
      expect(sceneAfterPlayback(false)).toBe('overview');
    });
  });

  describe('isOverview', () => {
    test('sees the whole network from above in the overview and the end card over it, and nowhere before', () => {
      expect(['overview', 'end', 'done'].map(scene => isOverview(scene as 'end'))).toEqual([true, true, true]);
      expect(['title', 'history', 'planTitle', 'plan'].map(scene => isOverview(scene as 'end'))).toEqual([false, false, false, false]);
    });
  });

  describe('videoPlansOf', () => {
    /**
     * A plan of a status, as the network gives it.
     *
     * @param id - Its id.
     * @param status - How far it has got.
     * @returns The plan.
     */
    const planOf = (id: string, status: PlanStatus): PlanInfo => ({ id: planId(id), name: id, status, facts: { stations: 0, km: 0, lines: [] } });

    test('plays what is being built, then what is committed to, each in the order kept, and none of the rest', () => {
      const plans = [
        planOf('later', 'planned'),
        planOf('old', 'abandoned'),
        planOf('now', 'under-construction'),
        planOf('idea', 'concept'),
        planOf('next', 'planned'),
      ];
      expect(videoPlansOf(plans, false).map(plan => plan.name)).toEqual(['now', 'later', 'next']);
    });

    test('plays none after a network never built, whose history is its plan', () => {
      expect(videoPlansOf([planOf('only', 'planned')], true)).toEqual([]);
    });
  });

  describe('fadedIn', () => {
    test('rises from nothing to whole over the fade, and stays', () => {
      expect(fadedIn(-100, 600)).toBe(0);
      expect(fadedIn(300, 600)).toBe(0.5);
      expect(fadedIn(9000, 600)).toBe(1);
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
      expect(videoPaddingOf({ width: 1920, height: 1080 })).toEqual({ top: 173, bottom: 281, left: 154, right: 154 });
      expect(videoPaddingOf({ width: 1080, height: 1920 }).bottom).toBe(499);
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
    const still = { elapsed: 0, sinceCaption: 0, sinceCaptionGone: null };

    test('shows the title over its scene alone, fading in and out', () => {
      expect(videoLayersOf({ ...still, scene: 'title', elapsed: TITLE_MS / 2 }).title).toBe(1);
      expect(videoLayersOf({ ...still, scene: 'title', elapsed: TITLE_MS }).title).toBe(0);
      expect(videoLayersOf({ ...still, scene: 'history', elapsed: TITLE_MS / 2 }).title).toBe(0);
    });

    test("shows a plan's card over its scene alone, fading in and out", () => {
      expect(videoLayersOf({ ...still, scene: 'planTitle', elapsed: PLAN_TITLE_MS / 2 }).plan).toBe(1);
      expect(videoLayersOf({ ...still, scene: 'planTitle', elapsed: PLAN_TITLE_MS }).plan).toBe(0);
      expect(videoLayersOf({ ...still, scene: 'plan', elapsed: PLAN_TITLE_MS / 2 }).plan).toBe(0);
    });

    test('brings the year in with the history, keeps it through the plans and the overview, and swaps it for the end card', () => {
      expect(videoLayersOf({ ...still, scene: 'history', elapsed: FADE_MS / 2 }).year).toBe(0.5);
      expect(['planTitle', 'plan', 'overview'].map(scene => videoLayersOf({ ...still, scene: scene as 'plan' }).year)).toEqual([1, 1, 1]);
      expect(videoLayersOf({ ...still, scene: 'overview' }).end).toBe(0);
      expect(videoLayersOf({ ...still, scene: 'end', elapsed: FADE_MS / 2 })).toMatchObject({ year: 0.5, end: 0.5 });
      expect(videoLayersOf({ ...still, scene: 'end', elapsed: FADE_MS })).toMatchObject({ year: 0, end: 1 });
      expect(videoLayersOf({ ...still, scene: 'done' }).end).toBe(1);
    });

    test('fades a caption in as its change starts and out once it goes, never more than the year', () => {
      const playing = { scene: 'history' as const, elapsed: 10_000 };
      expect(videoLayersOf({ ...playing, sinceCaption: FADE_MS / 2, sinceCaptionGone: null }).caption).toBe(0.5);
      expect(videoLayersOf({ ...playing, sinceCaption: 5000, sinceCaptionGone: null }).caption).toBe(1);
      expect(videoLayersOf({ ...playing, sinceCaption: 5000, sinceCaptionGone: FADE_MS }).caption).toBe(0);
      expect(videoLayersOf({ scene: 'history', elapsed: FADE_MS / 4, sinceCaption: 5000, sinceCaptionGone: null }).caption).toBe(0.25);
    });
  });

  describe('videoMapPropsOf', () => {
    const facts = {} as NetworkFacts;
    const size = { width: 1920, height: 1080 };

    test("shows the network dark, seen as asked, at the video's pace, without street names, framing clear of what lies over it", () => {
      expect(videoMapPropsOf({ facts, size, viewMode: '3d', overview: false, boundary: AROUND_TINY })).toEqual({
        facts,
        theme: 'dark',
        viewMode: '3d',
        overlay: null,
        boundary: AROUND_TINY,
        speed: VIDEO_SPEED,
        streetLabels: false,
        padding: videoPaddingOf(size),
      });
    });

    test("lies flat for the overview, the city's coverage drawn within its outline, where it has one", () => {
      expect(videoMapPropsOf({ facts, size, viewMode: '3d', overview: true, boundary: AROUND_TINY })).toMatchObject({
        viewMode: '2d',
        overlay: { kind: 'coverage', metres: COVERAGE_DEFAULT_METRES },
      });
      expect(videoMapPropsOf({ facts, size, viewMode: '3d', overview: true, boundary: null }).overlay).toBeNull();
    });
  });

  describe('videoYearOf', () => {
    test('says the year the history is in, and "Plan" while a plan plays, which has no date', () => {
      const time = { time: Date.UTC(1995, 11, 29), inPlan: false } as TimeState;
      expect(videoYearOf(time)).toBe('1995');
      expect(videoYearOf({ ...time, inPlan: true })).toBe('Plan');
    });
  });

  describe('videoViewOf', () => {
    test('sees the video in 3D, unless its address asks for flat', () => {
      expect(videoViewOf(undefined)).toBe('3d');
      expect(videoViewOf('3d')).toBe('3d');
      expect(videoViewOf('2d')).toBe('2d');
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
   * @returns The store, and the commands its map was given.
   */
  const readyVideo = async (network = tinyNetwork()) => {
    setActivePinia(createPinia());
    const store = useVideoStore();
    store.OPEN({ network, size: { width: 1920, height: 1080 }, viewMode: '3d', outline: OUTLINE });
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

  test('plays the history, then each plan going ahead from today, then the whole network from above, its coverage drawn', async () => {
    const { store, commands } = await readyVideo();
    store.START();
    store.TICK(TITLE_MS);
    expect(store.scene).toBe('history');
    expect(commands.at(-1)).toEqual({ name: 'play', args: [store.facts?.playheads.start()] });

    store.END_PLAYBACK();
    expect(store.scene).toBe('planTitle');
    expect(store.plan?.status).toBe('planned');
    expect(store.mapProps?.facts).toBe(store.planFacts);
    store.TICK(TITLE_MS + PLAN_TITLE_MS);
    expect(store.scene).toBe('plan');
    expect(commands.at(-1)).toEqual({ name: 'play', args: [store.planFacts?.playheads.today()] });

    store.END_PLAYBACK();
    expect(store.scene).toBe('overview');
    expect(store.mapProps).toMatchObject({ facts: store.facts, viewMode: '2d', overlay: { kind: 'coverage' } });
    await nextTick();
    expect(commands.at(-1)?.name).toBe('fitNetwork');
    store.TICK(TITLE_MS + PLAN_TITLE_MS + OVERVIEW_MS);
    expect(store.scene).toBe('end');
    store.TICK(TITLE_MS + PLAN_TITLE_MS + OVERVIEW_MS + END_MS);
    expect(store.pageState).toBe('done');
  });

  test('goes from the history straight to the overview where no plan is going ahead', async () => {
    const network = tinyNetwork();
    for (const plan of Object.values(network.plans ?? {})) plan.status = 'abandoned';
    const { store } = await readyVideo(network);
    store.START();
    store.TICK(TITLE_MS);
    store.END_PLAYBACK();
    expect(store.scene).toBe('overview');
    expect(store.plan).toBeNull();
  });

  test('keeps the coverage the map measured for the end card, and takes no end of playback outside the history or a plan', async () => {
    const { store } = await readyVideo();
    const coverage = { name: 'Test', source: 'test', km2: 4, metres: COVERAGE_DEFAULT_METRES, share: 0.5, bands: [], beyond: { share: 0.5, km2: 2 } };
    store.SET_OVERLAY({ kind: 'coverage', coverage });
    expect(store.coverage).toEqual(coverage);
    store.END_PLAYBACK();
    expect(store.scene).toBe('ready');
  });
});
