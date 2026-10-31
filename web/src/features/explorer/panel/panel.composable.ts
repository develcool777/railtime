import { storeToRefs } from 'pinia';
import { computed } from 'vue';

import { currentChangeIndex } from '~/features/explorer/changes/changes.utils';
import { SECTIONS } from '~/features/explorer/explorer.constants';
import { useExplorerStore } from '~/features/explorer/explorer.store';
import type { PanelView } from '~/features/explorer/explorer.types';
import type { ExplorerPanel } from '~/features/explorer/panel/panel.composable.types';
import { lineTop, sectionTop, stationTop } from '~/features/explorer/panel/panel.utils';

/**
 * The panel's content: what the store has open (the section, the line or station views pushed over
 * it), answered by the network's facts for the moment the map shows, and what its top says. Each is
 * a computed of the store: it changes when the date or what is open does.
 *
 * @returns What the panel lists.
 */
export const useExplorerPanel = (): ExplorerPanel => {
  const store = useExplorerStore();
  const { section, views, openStation, openLine, timeMode, time, step, facts, plan, plans, visibleLines } = storeToRefs(store);

  const lines = computed(() => facts.value?.lines() ?? []);
  const changes = computed(() => facts.value?.changes() ?? []);
  const sections = computed(() => SECTIONS.filter(entry => entry.id !== 'plans' || plans.value.length > 0));
  const sectionLabel = computed(() => SECTIONS.find(entry => entry.id === section.value)?.label ?? 'Lines');

  /** The network at the moment the map shows: every question answered for then. */
  const now = computed(() => (facts.value && time.value ? facts.value.asOf(time.value) : null));

  const visible = computed(() => new Set(visibleLines.value ?? lines.value.map(line => line.id)));
  const setVisible = (next: Set<string>) =>
    store.showLines(
      next,
      lines.value.map(line => line.id),
    );

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
  const shownDate = computed(() => (!time.value || time.value.future ? null : time.value.time));

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
      visible: visible.value,
      changes: changes.value,
      currentChange: currentChange.value,
      time: time.value,
      planCount: plans.value.length,
      stationCount: stations.value.length,
    });
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
    visible,
    setVisible,
    currentChange,
    panelTop,
    shownDate,
  };
};
