import { computed, ref, watch } from 'vue';

import { currentChangeIndex } from '~/features/explorer/changes/changes.utils';
import { SECTIONS } from '~/features/explorer/explorer.constants';
import type { Section } from '~/features/explorer/explorer.types';
import type { ExplorerPanel, ExplorerPanelInput } from '~/features/explorer/panel/panel.composable.types';
import { lineTop, sectionTop, stationTop } from '~/features/explorer/panel/panel.utils';
import { nextStations } from '~/features/explorer/stations/station.utils';

/**
 * The panel: the section open, the line or station view pushed over it, what each lists on the
 * date shown, and what its top says. A station picked on the map opens its view wherever the panel is.
 *
 * @param input - The network and plan, the map, the layout, and what the time control shows.
 * @returns The panel's state and what changes it.
 */
export const useExplorerPanel = (input: ExplorerPanelInput): ExplorerPanel => {
  const { network, plan, chosenPlan, planCount, binding, layout, timeMode } = input;
  const { map, time, step, station, lines, changes } = binding;

  // A plan opens on Plans, where it was picked.
  const sections = SECTIONS.filter(entry => entry.id !== 'plans' || planCount > 0);
  const section = ref<Section>(plan ? 'plans' : 'lines');
  const sectionLabel = computed(() => sections.find(entry => entry.id === section.value)?.label ?? 'Lines');

  const visible = ref(new Set([...Object.keys(network.lines), ...Object.keys(chosenPlan.value?.lines ?? {})]));
  const setVisible = (next: Set<string>) => {
    visible.value = next;
    map.value?.setVisibleLines([...next]);
  };

  const openLine = ref<string | null>(null);
  const lineDetails = computed(() => {
    // Read for the date shown: a line's stops change with it.
    const shown = time.value?.cursor;
    return openLine.value && map.value && shown !== undefined ? map.value.getLineDetails(openLine.value) : null;
  });
  const lineChanges = computed(() => {
    const wanted = new Set(lineDetails.value?.changes ?? []);
    return changes.value.filter(change => wanted.has(change.index));
  });

  // None while playing, when the panel follows the changes.
  const stations = computed(() => (time.value && !time.value.playing && map.value ? map.value.getStations() : []));
  const stationColors = computed(() => new Map(stations.value.map(entry => [entry.id, entry.colors])));
  const stationNeighbours = computed(() => {
    const transitMap = map.value;
    // Read for the date shown: lines open and close.
    const shown = time.value?.cursor;
    if (!station.value || !transitMap || shown === undefined) return [];
    return nextStations(
      station.value.id,
      station.value.lines.map(line => transitMap.getLineDetails(line.id)),
    );
  });

  const currentChange = computed(() => currentChangeIndex(changes.value, time.value, timeMode.value === 'playing' && step.value !== null));
  const shownDate = computed(() => (!time.value || time.value.future ? null : time.value.time));

  const panelTop = computed(() => {
    if (station.value) return stationTop(station.value, lineDetails.value?.name ?? sectionLabel.value);
    if (lineDetails.value) return lineTop(lineDetails.value, sectionLabel.value);
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
    });
  });

  const closeStation = () => {
    station.value = null;
    map.value?.selectStation(null);
  };
  const openStation = (id: string) => {
    if (!map.value) return;
    station.value = map.value.getStationInfo(id);
    map.value.selectStation(id);
  };
  // A station picked on the map opens its view in the panel, wherever the panel is.
  watch(
    () => station.value?.id,
    picked => {
      if (picked) layout.revealPanel();
    },
  );

  const hasPushedView = () => station.value !== null || openLine.value !== null;
  const openSection = (id: Section) => {
    section.value = id;
    closeStation();
    openLine.value = null;
    layout.revealPanel();
  };
  // Beside the map, the open section's own icon folds the panel, as an editor's activity bar does.
  const pickSection = (id: Section) => {
    if (!layout.phone.value && layout.panelOpen.value && section.value === id && !hasPushedView()) layout.panelOpen.value = false;
    else openSection(id);
  };
  const goBack = () => {
    if (station.value) closeStation();
    else openLine.value = null;
  };
  const pushLine = (id: string) => {
    closeStation();
    openLine.value = id;
    layout.revealPanel();
  };

  const showChange = (index: number) => map.value?.showChange(index);
  const pickChange = (index: number) => {
    if (timeMode.value === 'playing') map.value?.playFrom(index);
    else showChange(index);
  };
  const followPlayback = () => {
    closeStation();
    openLine.value = null;
    section.value = 'changes';
  };

  return {
    sections,
    section,
    openLine,
    lineDetails,
    lineChanges,
    stations,
    stationColors,
    stationNeighbours,
    visible,
    setVisible,
    currentChange,
    panelTop,
    shownDate,
    pickSection,
    openSection,
    goBack,
    hasPushedView,
    pushLine,
    openStation,
    closeStation,
    pickChange,
    showChange,
    followPlayback,
  };
};
