import type { ChangeInfo, LineInfo, Stop } from '@railtime/network/facts.types';
import type { TimeState } from '@railtime/renderer/transitMap.types';

import type { Section } from '~/features/explorer/explorer.types';
import type { RouteEnds } from '~/features/explorer/tools.types';

/** What the panel's top says: the view's title, a line of context, and the way back from a pushed view. */
export type PanelTopContent = {
  title: string;
  context: string;
  /** Line colours leading the context. */
  dots?: string[];
  /** Where the back link returns to; none on a section's own list. */
  backLabel?: string;
};

/** What a section's top is worked out from. */
export type SectionTopInput = {
  section: Section;
  /** The section's name, as the rail shows it. */
  label: string;
  /** The time control is the player: Changes follows playback. */
  playing: boolean;
  /** A plan is shown: what plays is the plan. */
  hasPlan: boolean;
  lines: LineInfo[];
  /** How many lines are hidden. */
  hidden: number;
  changes: ChangeInfo[];
  /** The change the map is at, if any. */
  currentChange: number | null;
  time: TimeState | null;
  /** How many plans the city has. */
  planCount: number;
  /** How many stations are on the map on the date shown. */
  stationCount: number;
};

/** The plan shown, for the time control: its name, what became of it (its status) and what it adds. */
export type PlanSummary = { name: string; status: string; facts: string };

/** The legend for a plan's dashed track: its name, and its first line's colour, as CSS. */
export type PlanLegend = { name: string; color: string };

/** What a section's dot is worked out from: a plan shown, a route's ends, a reach's start. */
export type MarksInput = { planShown: boolean; routeEnds: RouteEnds; reachFrom: Stop | null };
