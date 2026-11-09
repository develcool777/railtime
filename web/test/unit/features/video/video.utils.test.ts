import { COVERAGE_DEFAULT_METRES } from '@railtime/network/coverage.constants';
import type { NetworkFacts } from '@railtime/network/facts.service';
import type { ChangeInfo, PlanInfo } from '@railtime/network/facts.types';
import { AROUND_TINY } from '@railtime/network/testing/boundaries';
import type { PlanStatus } from '@railtime/schema/network.types';
import { planId } from '@railtime/schema/testing/ids';
import { describe, expect, test } from 'vitest';
import { INSIGHTS_COLUMN_VW } from '~/features/video/insights/insights.constants';
import { FADE_MS, PLAN_END_VW, PLAN_INTRO_MS, SCENE_MS, VIDEO_SPEED } from '~/features/video/video.constants';
import {
  historySpan,
  pageStateOf,
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

    test.each([
      { width: 1920, height: 1080 },
      { width: 1080, height: 1920 },
    ])('keeps the network off the panels and the plan card as they are laid out, at $width by $height', size => {
      // Each stands in from the frame's edge: the panels by 2.5vmin, the plan's card by 5.
      const edge = Math.min(size.width, size.height) / 100;
      expect(videoPaddingOf(size, 'insights').left).toBeGreaterThan((size.width * INSIGHTS_COLUMN_VW) / 100 + 2.5 * edge);
      expect(videoPaddingOf(size, 'insights').right).toBeGreaterThan((size.width * INSIGHTS_COLUMN_VW) / 100 + 2.5 * edge);
      expect(videoPaddingOf(size, 'ending').left).toBeGreaterThan((size.width * PLAN_END_VW) / 100 + 5 * edge);
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
      expect(spokenAddress('https://example.org/')).toBe('example.org');
      expect(spokenAddress('http://localhost:5180/')).toBe('localhost:5180');
    });
  });
});
