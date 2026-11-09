import { NetworkFacts } from '@railtime/network/facts.service';
import { AROUND_TINY } from '@railtime/network/testing/boundaries';
import { planOnlyNetwork } from '@railtime/network/testing/planOnlyNetwork';
import { tinyNetwork } from '@railtime/network/testing/tinyNetwork';
import { planId } from '@railtime/schema/testing/ids';
import { describe, expect, test } from 'vitest';
import { INSIGHTS_DRAW_MS, INSIGHTS_STAGGER_MS, INSIGHTS_START_MS } from '~/features/video/insights/insights.constants';
import { countUp, coverageTitleOf, insightsMotionOf, linesTitleOf, planGainOf, sharesOf, videoInsightsOf } from '~/features/video/insights/insights.utils';
import { FADE_MS, SCENE_MS } from '~/features/video/video.constants';

describe('InsightsUtils', () => {
  describe('videoInsightsOf', () => {
    const facts = NetworkFacts.create(tinyNetwork());

    test('asks the network for its size, history, lines and coverage', () => {
      const insights = videoInsightsOf(facts, AROUND_TINY);
      expect(insights.stats).toEqual(facts.today().stats());
      expect(insights.stationYears).toEqual(facts.growth().years.map(({ year, stations }) => ({ year, value: stations })));
      expect(insights.busiest).toEqual(facts.growth().busiest);
      expect(insights.lines.length).toBeGreaterThan(0);
      expect(insights.coverage?.info.name).toBe(AROUND_TINY.name);
      expect(insights.coverage?.years.length).toBeGreaterThan(0);
    });

    test('measures no coverage without an outline', () => {
      expect(videoInsightsOf(facts, null).coverage).toBeNull();
    });

    test('has no history for a network never built', () => {
      const insights = videoInsightsOf(NetworkFacts.create(planOnlyNetwork()), AROUND_TINY);
      expect(insights).toMatchObject({ stationYears: [], decades: [], busiest: null });
      expect(insights.coverage?.years).toEqual([]);
    });
  });

  describe('coverageTitleOf', () => {
    test('says what coverage measures, where, and how far', () => {
      expect(coverageTitleOf(NetworkFacts.create(tinyNetwork()).coverage(AROUND_TINY).info(0, 800))).toBe(`${AROUND_TINY.name} within 800 m of a station`);
    });
  });

  describe('linesTitleOf', () => {
    test('calls them the longest only where it leaves some out', () => {
      const { stats, lines } = videoInsightsOf(NetworkFacts.create(tinyNetwork()), null);
      expect(linesTitleOf({ lines, stats })).toBe('Lines');
      expect(linesTitleOf({ lines, stats: { ...stats, lines: lines.length + 1 } })).toBe('Longest lines');
    });
  });

  describe('planGainOf', () => {
    const today = NetworkFacts.create(tinyNetwork());
    const planned = NetworkFacts.create(tinyNetwork(), { plan: planId('extension') });
    const before = today.asOf(today.playheads.rest()).stats();
    const after = planned.asOf(planned.playheads.rest()).stats();

    test('says what the plan changes, from the network without it to the network with it', () => {
      const gains = planGainOf(today, planned, AROUND_TINY);
      expect(gains.find(gain => gain.label === 'Stations')).toMatchObject({ from: before.stations, to: after.stations, before: String(before.stations) });
      expect(gains.find(gain => gain.label === 'Track')).toMatchObject({ from: Math.round(before.km), to: Math.round(after.km), unit: ' km' });
      expect(gains.at(-1)).toMatchObject({ label: coverageTitleOf(today.coverage(AROUND_TINY).info(0, 800)), unit: '%' });
    });

    test('leaves out what it reaches without an outline, and whatever it leaves as it is', () => {
      expect(planGainOf(today, planned, null).map(gain => gain.unit)).not.toContain('%');
      expect(planGainOf(today, today, AROUND_TINY)).toEqual([]);
    });
  });

  describe('insightsMotionOf', () => {
    const last = INSIGHTS_START_MS + 3 * INSIGHTS_STAGGER_MS + FADE_MS / 2 + INSIGHTS_DRAW_MS;

    test('shows nothing at the very start of its scene', () => {
      expect(insightsMotionOf('insights', INSIGHTS_START_MS, false).growth).toMatchObject({ shown: 0, drawn: 0 });
    });

    test('brings the panels in one after another', () => {
      const { growth, lines } = insightsMotionOf('insights', INSIGHTS_START_MS + INSIGHTS_STAGGER_MS / 2, false);
      expect(growth.shown).toBeGreaterThan(0);
      expect(lines.shown).toBe(0);
    });

    test('counts its numbers along with its chart, resting on them through a scene after it', () => {
      expect(insightsMotionOf('insights', INSIGHTS_START_MS + FADE_MS / 2, false).growth.counted).toBe(0);
      expect(insightsMotionOf('end', 0, false).growth.counted).toBe(Infinity);
    });

    test('has each panel whole once its time is up, and on through an end card over them', () => {
      expect(insightsMotionOf('insights', last, false).coverage).toMatchObject({ shown: 1, drawn: 1 });
      expect(insightsMotionOf('end', 0, false).coverage).toMatchObject({ shown: 1, drawn: 1 });
      expect(insightsMotionOf('done', 0, true).growth).toMatchObject({ shown: 1, drawn: 1 });
    });

    test('takes them out as their scene ends, if the next has none', () => {
      const scene = SCENE_MS.insights ?? 0;
      expect(insightsMotionOf('insights', scene - FADE_MS / 2, true).growth.shown).toBe(0.5);
      expect(insightsMotionOf('insights', scene, true).coverage.shown).toBe(0);
      expect(insightsMotionOf('insights', scene, false).coverage.shown).toBe(1);
    });
  });

  describe('countUp', () => {
    test('counts a number from nothing, along with its chart', () => {
      expect(countUp(120, { shown: 1, drawn: 0, counted: 0 }).now).toBe(0);
      expect(countUp(120, { shown: 1, drawn: 1, counted: Infinity })).toEqual({ now: 120, before: 120 });
    });
  });

  describe('sharesOf', () => {
    test('gives each value as a share of the largest', () => {
      expect(sharesOf([5, 10, 0])).toEqual([0.5, 1, 0]);
    });

    test('gives nothing where nothing is above 0', () => {
      expect(sharesOf([0, 0])).toEqual([0, 0]);
    });
  });
});
