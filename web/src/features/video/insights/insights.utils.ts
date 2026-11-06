import { COVERAGE_DEFAULT_METRES } from '@railtime/network/coverage.constants';
import type { NetworkFacts } from '@railtime/network/facts.service';
import type { CityBoundary } from '@railtime/schema/boundary.types';
import { INSIGHTS_DRAW_MS, INSIGHTS_LINES, INSIGHTS_PLACES, INSIGHTS_STAGGER_MS, INSIGHTS_START_MS } from '~/features/video/insights/insights.constants';
import type { InsightsPanel, PanelMotion, VideoInsights } from '~/features/video/insights/insights.types';
import { FADE_MS, SCENE_MS } from '~/features/video/video.constants';
import type { VideoScene } from '~/features/video/video.types';
import { easedOut, fadedIn } from '~/features/video/video.utils';

/**
 * A network's numbers for the panels, each asked of it: its size, lines and coverage where it rests,
 * and its history, which a network never built has none of.
 *
 * @param facts - The network.
 * @param boundary - The city's outline; `null` for none.
 * @returns The numbers.
 */
export const videoInsightsOf = (facts: NetworkFacts, boundary: CityBoundary | null): VideoInsights => {
  const rest = facts.playheads.rest();
  const end = facts.asOf(rest);
  const { years, decades, busiest } = facts.growth();
  const built = facts.hasHistory();
  const measure = boundary && facts.coverage(boundary);
  return {
    stats: end.stats(),
    years: built ? years : [],
    decades: built ? decades : [],
    busiest: built ? busiest : null,
    lines: end.records(INSIGHTS_LINES).longest,
    coverage: measure && { info: measure.info(rest.cursor, COVERAGE_DEFAULT_METRES), years: built ? measure.history(COVERAGE_DEFAULT_METRES) : [] },
  };
};

/**
 * How far each panel has come at a moment: in from its edge one after another, a moment into its
 * scene; whole in a scene after it, which it stays in; out as its scene ends, if the next has none.
 *
 * @param scene - The scene shown.
 * @param elapsed - How long it has shown, ms.
 * @param leaving - Whether the panels go with the scene.
 * @returns Each panel's motion.
 */
export const insightsMotionOf = (scene: VideoScene, elapsed: number, leaving: boolean): Record<InsightsPanel, PanelMotion> => {
  const since = scene === 'insights' ? elapsed - INSIGHTS_START_MS : Infinity;
  const staying = leaving ? fadedIn((SCENE_MS.insights ?? 0) - elapsed, FADE_MS) : 1;
  const motionAt = (place: number): PanelMotion => {
    const own = since - place * INSIGHTS_STAGGER_MS;
    return { shown: Math.min(easedOut(fadedIn(own, FADE_MS)), staying), drawn: easedOut(fadedIn(own - FADE_MS / 2, INSIGHTS_DRAW_MS)) };
  };
  return {
    growth: motionAt(INSIGHTS_PLACES.growth),
    lines: motionAt(INSIGHTS_PLACES.lines),
    decades: motionAt(INSIGHTS_PLACES.decades),
    coverage: motionAt(INSIGHTS_PLACES.coverage),
  };
};

/**
 * Each value as a share of the largest, for bars side by side.
 *
 * @param values - The values.
 * @returns Each one's share, 0 to 1; all 0 where none is above 0.
 */
export const sharesOf = (values: number[]): number[] => {
  const largest = Math.max(...values);
  return values.map(value => (largest > 0 ? value / largest : 0));
};
