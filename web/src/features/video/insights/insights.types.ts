import type { CoverageInfo, CoverageYear, DecadeOpenings, NetworkRecords, NetworkStats, YearStats } from '@railtime/network/facts.types';

/** A panel round the map. */
export type InsightsPanel = 'growth' | 'decades' | 'lines' | 'coverage';

/** How far a panel has come this frame, each 0 to 1: in from its edge, and its chart revealed. */
export type PanelMotion = { shown: number; drawn: number };

/** How much of the city the network reaches, now and year by year. */
type InsightsCoverage = { info: CoverageInfo; years: CoverageYear[] };

/** The network's numbers, for the panels round the map. */
export type VideoInsights = {
  /** The network's size. */
  stats: NetworkStats;
  /** The network year by year; none for one never built. */
  years: YearStats[];
  /** How many stations opened in each decade; none for a network never built. */
  decades: DecadeOpenings[];
  /** The decade most did; `null` for a network never built. */
  busiest: DecadeOpenings | null;
  /** Its longest lines, longest first. */
  lines: NetworkRecords['longest'];
  /** How much of the city it reaches; `null` for a city without an outline. */
  coverage: InsightsCoverage | null;
};
