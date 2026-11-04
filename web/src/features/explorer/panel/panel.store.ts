import type { LineDirection } from '@railtime/network/facts.types';
import { defineStore } from 'pinia';
import { computed } from 'vue';

import { STORE_IDS } from '~/constants/store.constants';
import { currentChangeIndex } from '~/features/explorer/changes/changes.utils';
import { useExplorerStore } from '~/features/explorer/explorer.store';
import type { PanelView } from '~/features/explorer/explorer.types';
import { formatStats } from '~/features/explorer/format.utils';
import { useNetworkStore } from '~/features/explorer/network.store';
import { lineTop, marksOf, planLegendOf, planSummaryOf, sectionLabelOf, sectionTop, sectionsOf, stationTop } from '~/features/explorer/panel/panel.utils';
import { useTimeStore } from '~/features/explorer/time/time.store';
import { useToolsStore } from '~/features/explorer/tools.store';

/**
 * What the panel and the page around the map show: the sections, the line or station open, the
 * panel's top, the network's records and the stations on the map at the moment shown, the plan
 * shown, and each section's dot. Getters only, over the explorer's other stores, answered by the
 * network's facts for the moment the map shows; nothing reads this store, and it changes nothing.
 */
export const usePanelStore = defineStore(STORE_IDS.EXPLORER_PANEL, () => {
  const explorer = useExplorerStore();
  const network = useNetworkStore();
  const timeStore = useTimeStore();
  const tools = useToolsStore();

  // ---- Getters
  /** The rail's sections: Plans only for a city with plans. */
  const sections = computed(() => sectionsOf(network.plans.length));
  /** The network at the moment the map shows: every question answered for then. */
  const now = computed(() => (network.facts && timeStore.time ? network.facts.asOf(timeStore.time) : null));
  /** The line whose view is open, or under the station's, at the moment shown. */
  const lineDetails = computed(() => (explorer.openLine && now.value ? now.value.line(explorer.openLine) : null));
  /** That line's changes. */
  const lineChanges = computed(() => {
    const wanted = new Set(lineDetails.value?.changes ?? []);
    return network.changes.filter(change => wanted.has(change.index));
  });
  /** The station whose view is open, at the moment shown. */
  const station = computed(() => (explorer.openStation && now.value ? now.value.station(explorer.openStation) : null));
  /** The stops either side of the station whose view is open, on each of its lines, by line. */
  const stationDirections = computed(() =>
    explorer.openStation && now.value ? now.value.directions(explorer.openStation) : new Map<string, LineDirection[]>(),
  );
  /** The stations on the map at the moment shown; none while the map moves, when the panel follows the changes. */
  const stations = computed(() => (now.value && !timeStore.time?.playing ? now.value.stations() : []));
  /** Each station's lines' colours, to mark a line's interchanges. */
  const stationColors = computed(() => new Map(stations.value.map(entry => [entry.id, entry.colors])));
  /** The change the map is at, for the Changes list. */
  const currentChange = computed(() => currentChangeIndex(network.changes, timeStore.time, timeStore.playerShown && timeStore.step !== null));
  /**
   * What a pushed view is called, for the back link over it.
   *
   * @param view - The view.
   * @returns Its line's or station's name.
   */
  const nameOf = (view: PanelView) => network.facts?.find(view.kind, view.id)?.name ?? view.id;
  /** Where the back link over a pushed view returns to: the view under it, else the section. */
  const backLabel = computed(() => {
    const under = explorer.views.at(-2);
    return under ? nameOf(under) : sectionLabelOf(explorer.section);
  });
  /** What the panel's top says. */
  const panelTop = computed(() => {
    if (station.value) return stationTop(station.value, backLabel.value);
    if (lineDetails.value) return lineTop(lineDetails.value, backLabel.value);
    return sectionTop({
      section: explorer.section,
      label: sectionLabelOf(explorer.section),
      playing: timeStore.playerShown,
      hasPlan: network.plan !== undefined,
      lines: network.lines,
      hidden: network.hidden.length,
      changes: network.changes,
      currentChange: currentChange.value,
      time: timeStore.time,
      planCount: network.plans.length,
      stationCount: stations.value.length,
    });
  });
  /** The network's records at the moment shown. */
  const records = computed(() => now.value?.records(5) ?? null);
  /** The plan shown, among the city's. */
  const chosenPlan = computed(() => network.plans.find(entry => entry.id === network.plan));
  /** The plan shown, for the time control. */
  const planSummary = computed(() => planSummaryOf(chosenPlan.value));
  /** The legend for the plan's dashed track, while the map shows it, paused. */
  const planLegend = computed(() => planLegendOf(chosenPlan.value, Boolean(timeStore.time?.inPlan) && !timeStore.playerShown));
  /** The network built today, to set beside a plan; with a plan shown the facts are the plan's, and the card goes without. */
  const builtFacts = computed(() => (network.facts && !network.plan ? formatStats(network.facts.today().stats()) : ''));
  /** A dot on each section whose choice is in force while another is open. */
  const marks = computed(() => marksOf({ planShown: network.plan !== undefined, routeEnds: tools.routeEnds, reachFrom: tools.reachFrom }));

  return {
    // Getters
    sections,
    lineDetails,
    lineChanges,
    station,
    stationDirections,
    stations,
    stationColors,
    currentChange,
    panelTop,
    records,
    planSummary,
    planLegend,
    builtFacts,
    marks,
  };
});
