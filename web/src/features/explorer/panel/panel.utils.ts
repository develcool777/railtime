import { toTimestamp, yearOf } from '@railtime/core/date.utils';
import { byCodeUnits } from '@railtime/core/text.utils';
import type { LineDetails, PlanInfo, StationInfo } from '@railtime/network/facts.types';
import { SECTIONS } from '~/features/explorer/explorer.constants';
import type { Section, SectionEntry } from '~/features/explorer/explorer.types';
import { formatDay, formatPlanFacts } from '~/features/explorer/format.utils';
import type { MarksInput, PanelTopContent, PlanLegend, PlanSummary, SectionTopInput } from '~/features/explorer/panel/panel.types';
import { PLAN_STATUSES } from '~/features/explorer/plans/plan.constants';
import { counted, lineColor } from '~/utils/format.utils';

/**
 * The top of a station's view: its name; under it, its names in other languages and the year its
 * first line called there; its lines' colours.
 *
 * @param station - The station, on the date shown.
 * @param backLabel - What the view was opened over.
 * @returns The panel's top.
 */
export const stationTop = (station: StationInfo, backLabel: string): PanelTopContent => {
  const opened = station.lines.flatMap(line => (line.opened ? [line.opened] : [])).toSorted(byCodeUnits)[0];
  return {
    title: station.name,
    context: [...station.otherNames, opened ? `opened ${yearOf(toTimestamp(opened))}` : 'planned'].join(' · '),
    dots: station.lines.map(line => lineColor(line.color)),
    backLabel,
  };
};

/**
 * The top of a line's view: its name, the year it opened and, while open, its size on the date shown.
 *
 * @param line - The line, on the date shown.
 * @param backLabel - What the view was opened over.
 * @returns The panel's top.
 */
export const lineTop = (line: LineDetails, backLabel: string): PanelTopContent => {
  const opened = line.opened === null ? 'planned' : `opened ${yearOf(line.opened)}`;
  const size = line.branches.length > 0 ? ` · ${line.stations} stations · ${Math.round(line.km)} km` : '';
  return { title: line.name, context: `${opened}${size}`, dots: [lineColor(line.color)], backLabel };
};

/**
 * The top of the Lines list: its name and how many lines, and how many of them are hidden.
 *
 * @param input - The section, and what its counts are read from.
 * @returns The panel's top.
 */
const linesTop = (input: SectionTopInput): PanelTopContent => {
  const count = counted(input.lines.length, 'line');
  return { title: input.label, context: input.hidden > 0 ? `${count} · ${input.hidden} hidden` : count };
};

/**
 * The top of the Changes list: while it plays, what is playing and the change it is at; else its
 * name, how many changes and the year of the first.
 *
 * @param input - The section, and what its counts are read from.
 * @returns The panel's top.
 */
const changesTop = (input: SectionTopInput): PanelTopContent => {
  const { playing, time, changes, currentChange } = input;
  const playingTitle = input.hasPlan ? 'Playing the plan' : 'Playing history';
  const title = playing ? playingTitle : input.label;
  if (playing && currentChange !== null && time)
    return { title, context: `${currentChange + 1} of ${changes.length} · ${time.inPlan ? 'Plan' : formatDay(time.time)}` };
  const first = changes.find(change => change.time !== null)?.time;
  const count = counted(changes.length, 'change');
  return { title, context: first ? `${count} since ${yearOf(first)}` : count };
};

/**
 * The top of a section's own list: its name (Changes says what is playing while it plays) and its counts.
 *
 * @param input - The section, and what its counts are read from.
 * @returns The panel's top.
 */
export const sectionTop = (input: SectionTopInput): PanelTopContent => {
  const { section } = input;
  if (section === 'lines') return linesTop(input);
  if (section === 'stations') return { title: input.label, context: `${counted(input.stationCount, 'station')} on the map` };
  if (section === 'changes') return changesTop(input);
  if (section === 'route') return { title: input.label, context: 'Between any two stations, on the date shown' };
  if (section === 'insights') return { title: input.label, context: 'How the network grew, and its records' };
  if (section === 'reach') return { title: input.label, context: 'How far you get from a station' };
  if (section === 'coverage') return { title: input.label, context: 'How much of the city is near a station' };
  return { title: input.label, context: `${counted(input.planCount, 'plan')} drawn up` };
};

/**
 * The rail's sections: Plans only for a city with plans.
 *
 * @param planCount - How many plans the city has.
 * @returns The sections, in the rail's order.
 */
export const sectionsOf = (planCount: number): SectionEntry[] => SECTIONS.filter(entry => entry.id !== 'plans' || planCount > 0);

/**
 * A section's name, as the rail shows it.
 *
 * @param section - The section.
 * @returns Its name.
 */
export const sectionLabelOf = (section: Section): string => SECTIONS.find(entry => entry.id === section)?.label ?? 'Lines';

/**
 * A dot on each section whose choice is in force while another is open: a plan shown, a route's ends
 * both set, a reach's start set; each says what is set.
 *
 * @param input - Whether a plan is shown, the route's ends, the reach's start.
 * @returns What each marked section's dot says, by section.
 */
export const marksOf = (input: MarksInput): Partial<Record<Section, string>> => {
  const marks: Partial<Record<Section, string>> = {};
  if (input.planShown) marks.plans = 'A plan is shown';
  const { from, to } = input.routeEnds;
  if (from && to) marks.route = `A route from ${from.name} to ${to.name} is set`;
  if (input.reachFrom) marks.reach = `How far one gets from ${input.reachFrom.name} is set`;
  return marks;
};

/**
 * The plan shown, for the time control: its name, what became of it and what it adds.
 *
 * @param plan - The plan, if one is shown.
 * @returns What the time control says of it, or nothing for none.
 */
export const planSummaryOf = (plan: PlanInfo | undefined): PlanSummary | undefined =>
  plan ? { name: plan.name, status: PLAN_STATUSES[plan.status].label, facts: formatPlanFacts(plan.facts.stations, plan.facts.km) } : undefined;

/**
 * The legend for a plan's dashed track, while the map shows the plan and is not playing: the plan's
 * name and its first line's colour (the page's text colour for a plan of no lines).
 *
 * @param plan - The plan, if one is shown.
 * @param showsPlan - The map shows the plan, paused.
 * @returns The legend, or `null` for none.
 */
export const planLegendOf = (plan: PlanInfo | undefined, showsPlan: boolean): PlanLegend | null => {
  if (!plan || !showsPlan) return null;
  const firstLine = plan.facts.lines[0];
  return { name: plan.name, color: firstLine ? lineColor(firstLine.color) : 'var(--ui-text-highlighted)' };
};
