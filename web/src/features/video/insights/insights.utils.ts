import { COVERAGE_DEFAULT_METRES } from '@railtime/network/coverage.constants';
import type { NetworkFacts } from '@railtime/network/facts.service';
import type { CoverageInfo } from '@railtime/network/facts.types';
import type { CityBoundary } from '@railtime/schema/boundary.types';
import {
  INSIGHTS_CHART_SHARES,
  INSIGHTS_DRAW_MS,
  INSIGHTS_LINE_SHARE,
  INSIGHTS_LINES,
  INSIGHTS_PLACES,
  INSIGHTS_STAGGER_MS,
  INSIGHTS_START_MS,
} from '~/features/video/insights/insights.constants';
import type { InsightsPanel, PanelMotion, PlanGain, VideoInsights } from '~/features/video/insights/insights.types';
import { FADE_MS, SCENE_MS } from '~/features/video/video.constants';
import type { VideoScene } from '~/features/video/video.types';
import type { Count } from '~/utils/count.types';
import { countOf, shareNumberOf } from '~/utils/count.utils';
import { formatNumber, formatShare, formatWalk } from '~/utils/format.utils';
import { easedOut, fadedIn } from '~/utils/motion.utils';

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
 * What coverage measures, in words.
 *
 * @param info - The coverage.
 * @returns "Kyiv within 800 m of a station".
 */
export const coverageTitleOf = (info: CoverageInfo): string => `${info.name} within ${formatWalk(info.metres)} of a station`;

/**
 * The lines panel's title: it says longest only where it leaves some out.
 *
 * @param insights - The network's numbers.
 * @returns What the panel is called.
 */
export const linesTitleOf = ({ lines, stats }: Pick<VideoInsights, 'lines' | 'stats'>): string => (lines.length < stats.lines ? 'Longest lines' : 'Lines');

/**
 * How tall the coverage chart is, as a share of the frame's height: the lines above it take only their
 * room, and it has what they leave.
 *
 * @param listed - How many lines the panel above lists.
 * @returns Its share.
 */
export const coverageChartShareOf = (listed: number): number => INSIGHTS_CHART_SHARES.short + (INSIGHTS_LINES - listed) * INSIGHTS_LINE_SHARE;

/**
 * How much of the city a network reaches, where it rests.
 *
 * @param facts - The network.
 * @param boundary - The city's outline.
 * @returns Its coverage.
 */
const coverageAtRest = (facts: NetworkFacts, boundary: CityBoundary): CoverageInfo =>
  facts.coverage(boundary).info(facts.playheads.rest().cursor, COVERAGE_DEFAULT_METRES);

/**
 * What a plan changes, each thing asked of the network without it and with it: its lines, stations and
 * track, and how much of the city it reaches. What it leaves as it is goes unsaid.
 *
 * @param today - The network as built.
 * @param planned - The network with the plan laid on it.
 * @param boundary - The city's outline; `null` for none, which leaves out what it reaches.
 * @returns What it changes.
 */
export const planGainOf = (today: NetworkFacts, planned: NetworkFacts, boundary: CityBoundary | null): PlanGain[] => {
  const before = today.asOf(today.playheads.rest()).stats();
  const after = planned.asOf(planned.playheads.rest()).stats();
  const km = Math.round(before.km);
  const gains: PlanGain[] = [
    { label: 'Lines', before: formatNumber(before.lines), from: before.lines, to: after.lines, decimals: 0, unit: '' },
    { label: 'Stations', before: formatNumber(before.stations), from: before.stations, to: after.stations, decimals: 0, unit: '' },
    { label: 'Track', before: `${formatNumber(km)} km`, from: km, to: Math.round(after.km), decimals: 0, unit: ' km' },
  ];
  if (boundary) {
    const reached = coverageAtRest(today, boundary);
    const { value, decimals } = shareNumberOf(coverageAtRest(planned, boundary).share);
    gains.push({
      label: coverageTitleOf(reached),
      before: formatShare(reached.share),
      from: reached.share * 100 * 10 ** decimals,
      to: value,
      decimals,
      unit: '%',
    });
  }
  return gains.filter(gain => Math.round(gain.from) !== gain.to);
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
    const counted = own - FADE_MS / 2;
    return { shown: Math.min(easedOut(fadedIn(own, FADE_MS)), staying), drawn: easedOut(fadedIn(counted, INSIGHTS_DRAW_MS)), counted };
  };
  return {
    growth: motionAt(INSIGHTS_PLACES.growth),
    lines: motionAt(INSIGHTS_PLACES.lines),
    decades: motionAt(INSIGHTS_PLACES.decades),
    coverage: motionAt(INSIGHTS_PLACES.coverage),
  };
};

/**
 * A panel's number counting up from nothing, along with its chart.
 *
 * @param value - What it comes to.
 * @param motion - How far its panel has come.
 * @returns The count.
 */
export const countUp = (value: number, { counted }: PanelMotion): Count => countOf(0, value, counted, INSIGHTS_DRAW_MS);

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
