import { yearOf } from '@railtime/core/date.utils';
import { storeToRefs } from 'pinia';
import { computed } from 'vue';

import { currentChangeIndex } from '~/features/explorer/changes/changes.utils';
import { SECTIONS } from '~/features/explorer/explorer.constants';
import { useExplorerStore } from '~/features/explorer/explorer.store';
import type { PanelView, Section } from '~/features/explorer/explorer.types';
import { formatPlanFacts, formatStats, lineColor } from '~/features/explorer/format.utils';
import type { ExplorerPanel } from '~/features/explorer/panel/panel.composable.types';
import { lineTop, sectionTop, stationTop } from '~/features/explorer/panel/panel.utils';
import { PLAN_STATUSES } from '~/features/explorer/plans/plan.constants';

/**
 * What the panel and the page around the map show, as computeds of the store: the section open and
 * the views pushed over it, the route and the reach the map found, the network's growth and records,
 * the plan shown, and each section's dot. Answered by the network's facts for the moment the map
 * shows: each changes when the date or what is open does.
 *
 * @returns What the panel lists.
 */
export const useExplorerPanel = (): ExplorerPanel => {
  const store = useExplorerStore();
  const { section, views, openStation, openLine, timeMode, playing, time, step, facts, plan, plans, routeEnds, reachFrom, overlayResult } = storeToRefs(store);

  const lines = computed(() => facts.value?.lines() ?? []);
  const changes = computed(() => facts.value?.changes() ?? []);
  const sections = computed(() => SECTIONS.filter(entry => entry.id !== 'plans' || plans.value.length > 0));
  const sectionLabel = computed(() => SECTIONS.find(entry => entry.id === section.value)?.label ?? 'Lines');

  /** The network at the moment the map shows: every question answered for then. */
  const now = computed(() => (facts.value && time.value ? facts.value.asOf(time.value) : null));

  const lineDetails = computed(() => (openLine.value && now.value ? now.value.line(openLine.value) : null));
  const lineChanges = computed(() => {
    const wanted = new Set(lineDetails.value?.changes ?? []);
    return changes.value.filter(change => wanted.has(change.index));
  });
  const station = computed(() => (openStation.value && now.value ? now.value.station(openStation.value) : null));
  const stationDirections = computed(() => (openStation.value && now.value ? now.value.directions(openStation.value) : new Map()));

  // None while playing, when the panel follows the changes.
  const stations = computed(() => (now.value && !time.value?.playing ? now.value.stations() : []));
  const stationColors = computed(() => new Map(stations.value.map(entry => [entry.id, entry.colors])));

  const currentChange = computed(() => currentChangeIndex(changes.value, time.value, timeMode.value === 'playing' && step.value !== null));
  const shownDate = computed(() => (!time.value || time.value.inPlan ? null : time.value.time));

  /**
   * What a pushed view is called, for the back link over it.
   *
   * @param view - The view.
   * @returns Its line's or station's name.
   */
  const nameOf = (view: PanelView) => facts.value?.find(view.kind, view.id)?.name ?? view.id;
  const backLabel = computed(() => {
    const under = views.value.at(-2);
    return under ? nameOf(under) : sectionLabel.value;
  });

  const panelTop = computed(() => {
    if (station.value) return stationTop(station.value, backLabel.value);
    if (lineDetails.value) return lineTop(lineDetails.value, backLabel.value);
    return sectionTop({
      section: section.value,
      label: sectionLabel.value,
      playing: timeMode.value === 'playing',
      hasPlan: plan.value !== undefined,
      lines: lines.value,
      hidden: facts.value?.hidden.length ?? 0,
      changes: changes.value,
      currentChange: currentChange.value,
      time: time.value,
      planCount: plans.value.length,
      stationCount: stations.value.length,
    });
  });

  // What the map found for the overlay open.
  const foundRoute = computed(() => (overlayResult.value?.kind === 'route' ? overlayResult.value.route : null));
  const foundReach = computed(() => (overlayResult.value?.kind === 'reach' ? overlayResult.value.reach : null));

  // How the network grew (its facts work the years out once), and its records at the moment shown.
  const growth = computed(() => facts.value?.growth() ?? null);
  const hasHistory = computed(() => facts.value?.hasHistory() ?? false);
  const records = computed(() => now.value?.records(5) ?? null);
  // A plan has no year.
  const shownYear = computed(() => (time.value && !time.value.inPlan ? yearOf(time.value.time) : null));

  // The plan shown: its name, what became of it and what it adds, and the legend for its dashed track while the map shows it.
  const chosenPlan = computed(() => plans.value.find(entry => entry.id === plan.value));
  const planSummary = computed(() =>
    chosenPlan.value
      ? {
          name: chosenPlan.value.name,
          status: PLAN_STATUSES[chosenPlan.value.status].label,
          facts: formatPlanFacts(chosenPlan.value.facts.stations, chosenPlan.value.facts.km),
        }
      : undefined,
  );
  const planLegend = computed(() => {
    if (!chosenPlan.value || !time.value?.inPlan || playing.value) return null;
    const firstLine = chosenPlan.value.facts.lines[0];
    return { name: chosenPlan.value.name, color: firstLine ? lineColor(firstLine.color) : 'var(--ui-text-highlighted)' };
  });
  // The network built today, to set beside a plan; with a plan shown the facts are the plan's, and the card goes without.
  const builtFacts = computed(() => (facts.value && !plan.value ? formatStats(facts.value.today().stats()) : ''));

  // A dot on each section whose choice is in force while another is open: a plan shown, a route or a reach set.
  const marks = computed(() => {
    const shown: Partial<Record<Section, string>> = {};
    if (plan.value) shown.plans = 'A plan is shown';
    const { from, to } = routeEnds.value;
    if (from && to) shown.route = `A route from ${from.name} to ${to.name} is set`;
    if (reachFrom.value) shown.reach = `How far one gets from ${reachFrom.value.name} is set`;
    return shown;
  });

  return {
    sections,
    lines,
    changes,
    lineDetails,
    lineChanges,
    station,
    stations,
    stationColors,
    stationDirections,
    currentChange,
    panelTop,
    shownDate,
    foundRoute,
    foundReach,
    growth,
    hasHistory,
    records,
    shownYear,
    planSummary,
    planLegend,
    builtFacts,
    marks,
  };
};
