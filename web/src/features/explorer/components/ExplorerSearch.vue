<template>
  <UDashboardSearch
    v-model:open="open"
    v-model:searchTerm="query"
    :groups
    :colorMode="false"
    :fuse="{ fuseOptions: { keys: ['label', 'otherNames'] }, resultLimit: 8 }"
    placeholder="Stations, lines and cities"
    title="Search"
    description="Find a station, a line or a city"
    class="top-18 translate-y-0 rounded-lg shadow-[0_20px_60px_rgba(21,32,48,0.25)] sm:h-auto sm:max-h-[28rem] sm:max-w-[560px]"
    :ui="{ input: '[&_input]:h-13 [&_input]:text-base' }">
    <template #item-leading="{ item }">
      <span v-if="'colors' in item" class="flex w-[22px] flex-none gap-0.5">
        <span v-for="color in item.colors" :key="color" class="h-1.5 flex-1 rounded-full" :style="{ background: color }" />
      </span>
      <UIcon v-else name="i-lucide-map-pin" class="text-dimmed size-4" />
    </template>
    <template #item-trailing="{ item }">
      <span class="text-muted text-xs">{{ item.meta }}</span>
    </template>
  </UDashboardSearch>
</template>

<script setup lang="ts">
  import type { LineInfo, StationSummary } from '@railtime/renderer/transitMap.types';
  import { computed, ref } from 'vue';

  import { CITIES } from '~/constants/city.constants';

  const props = defineProps<{
    /** The stations on the map on the date shown. */
    stations: StationSummary[];
    lines: LineInfo[];
    /** The city shown, left out of the cities. */
    city: string;
  }>();
  const emit = defineEmits<{ station: [station: string]; line: [line: string]; city: [city: string] }>();
  /** Whether it is open: from the header's button, ⌘K or /. */
  const open = defineModel<boolean>('open', { default: false });

  const query = ref('');

  const groups = computed(() => [
    {
      id: 'stations',
      label: 'Stations',
      // Only once something is typed: a city has hundreds.
      items: query.value.trim()
        ? props.stations.map(station => ({
            label: station.name,
            otherNames: station.otherNames,
            colors: station.colors,
            meta: station.colors.length === 1 ? '1 line' : `${station.colors.length} lines`,
            onSelect: () => emit('station', station.id),
          }))
        : [],
    },
    {
      id: 'lines',
      label: 'Lines',
      items: props.lines.map(line => ({ label: line.name, colors: [line.color], meta: line.networkName, onSelect: () => emit('line', line.id) })),
    },
    {
      id: 'cities',
      label: 'Cities',
      items: CITIES.filter(entry => entry.value !== props.city).map(entry => ({
        label: entry.label,
        meta: entry.country,
        onSelect: () => emit('city', entry.value),
      })),
    },
  ]);
</script>
