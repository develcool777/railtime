<template>
  <div class="px-4 pb-6">
    <PanelSearch v-model="query" placeholder="Search stations" />
    <UEmpty v-if="stations.length === 0" class="mt-2" icon="i-lucide-circle-off" title="No station open" description="None is open on the date shown." />
    <UEmpty v-else-if="rows.length === 0" class="mt-2" icon="i-lucide-search-x" title="No station matches" description="Try another name." />
    <PanelList v-else label="Stations" :rows :estimate :covered="PANEL_SEARCH_HEIGHT">
      <template #sticky="{ row }">
        <div v-if="row.letter" class="eyebrow text-muted bg-default -mx-2 px-4 pt-2 pb-1">{{ row.letter }}</div>
      </template>
      <template #row="{ row }">
        <h3 v-if="row.heading" class="eyebrow text-muted px-2 pt-2 pb-1">{{ row.letter }}</h3>
        <div class="-mx-2">
          <ListRow @click="emit('open', row.station.id)">
            <span class="flex w-[22px] flex-none flex-wrap gap-0.5">
              <span
                v-for="color in row.station.colors"
                :key="`${color.light} ${color.dark}`"
                class="size-1.5 rounded-full"
                :style="{ background: lineColor(color) }" />
            </span>
            <span class="text-highlighted min-w-0 flex-1 truncate text-sm font-medium">{{ row.station.name }}</span>
            <span v-if="row.station.otherNames[0]" class="text-muted max-w-[40%] flex-none truncate text-xs">{{ row.station.otherNames[0] }}</span>
          </ListRow>
        </div>
      </template>
    </PanelList>
  </div>
</template>

<script setup lang="ts">
  import type { StationSummary } from '@railtime/network/facts.types';
  import { computed, ref } from 'vue';

  import { PANEL_SEARCH_HEIGHT } from '~/features/explorer/panel/panel.constants';
  import { LETTER_HEADING_ESTIMATE, STATION_ROW_ESTIMATE } from '~/features/explorer/stations/station.constants';
  import type { StationGroup, StationRow } from '~/features/explorer/stations/station.types';
  import { findStations, stationRows, stationsByLetter } from '~/features/explorer/stations/station.utils';
  import { lineColor } from '~/utils/format.utils';

  const props = defineProps<{
    /** The stations on the map on the date shown. */
    stations: StationSummary[];
  }>();
  const emit = defineEmits<{ open: [station: string] }>();

  const query = ref('');
  /** A to Z under their letters; searched, the best matches first, under no letter. */
  const groups = computed((): StationGroup[] => {
    if (!query.value.trim()) return stationsByLetter(props.stations);
    const found = findStations(props.stations, query.value, props.stations.length);
    return found.length > 0 ? [{ letter: '', stations: found }] : [];
  });
  const rows = computed(() => stationRows(groups.value));

  /**
   * How tall a row is likely to stand before it is measured.
   *
   * @param row - The row.
   * @returns Pixels.
   */
  const estimate = (row: StationRow) => STATION_ROW_ESTIMATE + (row.heading ? LETTER_HEADING_ESTIMATE : 0);
</script>
