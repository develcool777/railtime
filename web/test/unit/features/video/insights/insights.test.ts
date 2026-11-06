import { NetworkFacts } from '@railtime/network/facts.service';
import { AROUND_TINY } from '@railtime/network/testing/boundaries';
import { planOnlyNetwork } from '@railtime/network/testing/planOnlyNetwork';
import { tinyNetwork } from '@railtime/network/testing/tinyNetwork';
import { describe, expect, test } from 'vitest';
import { INSIGHTS_DRAW_MS, INSIGHTS_STAGGER_MS, INSIGHTS_START_MS } from '~/features/video/insights/insights.constants';
import { insightsMotionOf, sharesOf, videoInsightsOf } from '~/features/video/insights/insights.utils';
import { FADE_MS, SCENE_MS } from '~/features/video/video.constants';

describe('InsightsUtils', () => {
  describe('videoInsightsOf', () => {
    const facts = NetworkFacts.create(tinyNetwork());

    test('asks the network for its size, history, lines and coverage', () => {
      const insights = videoInsightsOf(facts, AROUND_TINY);
      expect(insights.stats).toEqual(facts.today().stats());
      expect(insights.years).toEqual(facts.growth().years);
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
      expect(insights).toMatchObject({ years: [], decades: [], busiest: null });
      expect(insights.coverage?.years).toEqual([]);
    });
  });

  describe('insightsMotionOf', () => {
    const last = INSIGHTS_START_MS + 3 * INSIGHTS_STAGGER_MS + FADE_MS / 2 + INSIGHTS_DRAW_MS;

    test('shows nothing at the very start of its scene', () => {
      expect(insightsMotionOf('insights', INSIGHTS_START_MS, false).growth).toEqual({ shown: 0, drawn: 0 });
    });

    test('brings the panels in one after another', () => {
      const { growth, lines } = insightsMotionOf('insights', INSIGHTS_START_MS + INSIGHTS_STAGGER_MS / 2, false);
      expect(growth.shown).toBeGreaterThan(0);
      expect(lines.shown).toBe(0);
    });

    test('has each panel whole once its time is up, and on through an end card over them', () => {
      expect(insightsMotionOf('insights', last, false).coverage).toEqual({ shown: 1, drawn: 1 });
      expect(insightsMotionOf('end', 0, false).coverage).toEqual({ shown: 1, drawn: 1 });
      expect(insightsMotionOf('done', 0, true).growth).toEqual({ shown: 1, drawn: 1 });
    });

    test('takes them out as their scene ends, if the next has none', () => {
      const scene = SCENE_MS.insights ?? 0;
      expect(insightsMotionOf('insights', scene - FADE_MS / 2, true).growth.shown).toBe(0.5);
      expect(insightsMotionOf('insights', scene, true).coverage.shown).toBe(0);
      expect(insightsMotionOf('insights', scene, false).coverage.shown).toBe(1);
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
