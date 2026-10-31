import type { StationInfo } from '@railtime/renderer/transitMap.types';
import { storeToRefs } from 'pinia';
import { computed, ref, shallowRef, watch } from 'vue';

import { currentChangeIndex } from '~/features/explorer/changes/changes.utils';
import { SECTIONS } from '~/features/explorer/explorer.constants';
import { useExplorerStore } from '~/features/explorer/explorer.store';
import type { PanelView } from '~/features/explorer/explorer.types';
import type { ExplorerPanel, ExplorerPanelInput } from '~/features/explorer/panel/panel.composable.types';
import { lineTop, sectionTop, stationTop } from '~/features/explorer/panel/panel.utils';
import type { LineDirection } from '~/features/explorer/stations/station.types';
import { directionsAt } from '~/features/explorer/stations/station.utils';

/**
 * The panel's content: what the store has open (the section, the line or station views pushed over
 * it), read from the map for the date shown, and what its top says. The station open is rung on the map.
 *
 * @param input - The network and plan, and the map.
 * @returns What the panel lists, and what changes the map from it.
 */
export const useExplorerPanel = (input: ExplorerPanelInput): ExplorerPanel => {
  const { network, plan, chosenPlan, planCount, binding } = input;
  const { map, time, step, lines, changes } = binding;
  const store = useExplorerStore();
  const { section, views, openStation, openLine, timeMode } = storeToRefs(store);

  const sections = SECTIONS.filter(entry => entry.id !== 'plans' || planCount > 0);
  const sectionLabel = computed(() => sections.find(entry => entry.id === section.value)?.label ?? 'Lines');

  const visible = ref(new Set([...Object.keys(network.lines), ...Object.keys(chosenPlan.value?.lines ?? {})]));
  const setVisible = (next: Set<string>) => {
    visible.value = next;
    map.value?.setVisibleLines([...next]);
  };

  /**
   * Whether the network, or the plan shown, has a line: a link can name one it does not.
   *
   * @param id - The line.
   * @returns True if it does.
   */
  const hasLine = (id: string) => network.lines[id] !== undefined || chosenPlan.value?.lines?.[id] !== undefined;
  const lineDetails = computed(() => {
    // Read for the date shown: a line's stops change with it.
    const shown = time.value?.cursor;
    return openLine.value && map.value && shown !== undefined && hasLine(openLine.value) ? map.value.getLineDetails(openLine.value) : null;
  });
  const lineChanges = computed(() => {
    const wanted = new Set(lineDetails.value?.changes ?? []);
    return changes.value.filter(change => wanted.has(change.index));
  });

  /**
   * Whether the network, or the plan shown, has a station: a link can name one it does not.
   *
   * @param id - The station.
   * @returns True if it does.
   */
  const hasStation = (id: string) => network.stations[id] !== undefined || chosenPlan.value?.stations?.[id] !== undefined;
  // Read again for the date shown, and the theme (its lines' colours, which `lines` follows).
  const station = shallowRef<StationInfo | null>(null);
  watch(
    [map, openStation, () => time.value?.cursor, lines],
    ([transitMap, id, shown]) => (station.value = transitMap && id && shown !== undefined && hasStation(id) ? transitMap.getStationInfo(id) : null),
    { immediate: true },
  );
  // The station open is the one rung on the map, however it was opened.
  watch([map, openStation], ([transitMap, id]) => transitMap?.selectStation(id && hasStation(id) ? id : null));

  // None while playing, when the panel follows the changes.
  const stations = computed(() => (time.value && !time.value.playing && map.value ? map.value.getStations() : []));
  const stationColors = computed(() => new Map(stations.value.map(entry => [entry.id, entry.colors])));
  const stationDirections = computed(() => {
    const transitMap = map.value;
    // Read for the date shown: lines open and close.
    const shown = time.value?.cursor;
    if (!station.value || !transitMap || shown === undefined) return new Map<string, LineDirection[]>();
    const here = station.value.id;
    return new Map(station.value.lines.map(line => [line.id, directionsAt(here, transitMap.getLineDetails(line.id))]));
  });

  const currentChange = computed(() => currentChangeIndex(changes.value, time.value, timeMode.value === 'playing' && step.value !== null));
  const shownDate = computed(() => (!time.value || time.value.future ? null : time.value.time));

  /**
   * What a pushed view is called, for the back link over it.
   *
   * @param view - The view.
   * @returns Its line's or station's name.
   */
  const nameOf = (view: PanelView) =>
    view.kind === 'line'
      ? (network.lines[view.id]?.name ?? chosenPlan.value?.lines?.[view.id]?.name ?? view.id)
      : (network.stations[view.id]?.name ?? chosenPlan.value?.stations?.[view.id]?.name ?? view.id);
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
      hasPlan: plan !== undefined,
      lines: lines.value,
      visible: visible.value,
      changes: changes.value,
      currentChange: currentChange.value,
      time: time.value,
      planCount,
      stationCount: stations.value.length,
    });
  });

  const showChange = (index: number) => map.value?.showChange(index);
  const pickChange = (index: number) => {
    if (timeMode.value === 'playing') map.value?.playFrom(index);
    else showChange(index);
  };

  return {
    sections,
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
    pickChange,
    showChange,
  };
};
