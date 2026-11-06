import type { CoverageInfo, CoverageYear, DecadeOpenings, NetworkRecords, NetworkStats } from '@railtime/network/facts.types';
import type { YearPoint } from '~/utils/yearChart.types';

/** A panel round the map. */
export type InsightsPanel = 'growth' | 'decades' | 'lines' | 'coverage';

/** How far a panel has come this frame: in from its edge and its chart revealed, each 0 to 1, and how long its numbers have counted, ms. */
export type PanelMotion = { shown: number; drawn: number; counted: number };

/** How much of the city the network reaches, now and year by year. */
type InsightsCoverage = { info: CoverageInfo; years: CoverageYear[] };

/** One thing a plan changes, as its end card says it. */
export type PlanGain = {
  /** What is measured. */
  label: string;
  /** What it is today, as written. */
  before: string;
  /** What it counts from and to, in the units of the reels. */
  from: number;
  to: number;
  /** How many of those digits follow a point. */
  decimals: number;
  /** What follows the number. */
  unit: string;
};

/** The network's numbers, for the panels round the map. */
export type VideoInsights = {
  /** The network's size. */
  stats: NetworkStats;
  /** Its stations year by year, as their chart takes them; none for a network never built. */
  stationYears: YearPoint[];
  /** How many stations opened in each decade; none for a network never built. */
  decades: DecadeOpenings[];
  /** The decade most did; `null` for a network never built. */
  busiest: DecadeOpenings | null;
  /** Its longest lines, longest first. */
  lines: NetworkRecords['longest'];
  /** How much of the city it reaches; `null` for a city without an outline. */
  coverage: InsightsCoverage | null;
};
