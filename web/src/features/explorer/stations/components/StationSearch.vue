<template>
  <UInputMenu
    v-model:searchTerm="query"
    :modelValue="undefined"
    :items="matches"
    ignoreFilter
    :placeholder
    variant="outline"
    class="w-full"
    :aria-label="placeholder"
    @update:modelValue="choose">
    <!-- Where the route starts, hollow; where it ends, filled. -->
    <template #leading>
      <span class="size-2 rounded-full border-2 border-(--ui-text-highlighted)" :class="{ 'bg-(--ui-text-highlighted)': end === 'to' }" />
    </template>
    <template #item-leading="{ item }">
      <span class="flex w-[22px] flex-none items-center gap-0.5 self-center">
        <span v-for="color in item.colors" :key="`${color.light} ${color.dark}`" class="h-1.5 flex-1 rounded-full" :style="{ background: lineColor(color) }" />
      </span>
    </template>
    <template #empty>
      <span class="text-muted text-sm">{{ query.trim() ? 'No station on the map matches.' : 'Type a station’s name.' }}</span>
    </template>
  </UInputMenu>
</template>

<script setup lang="ts">
  import type { StationSummary } from '@railtime/network/facts.types';
  import { computed, ref } from 'vue';

  import { findStations } from '~/features/explorer/stations/station.utils';
  import { lineColor } from '~/features/explorer/format.utils';

  /** How many matches the menu lists. */
  const MAX_MATCHES = 30;

  const props = withDefaults(
    defineProps<{
      /** The stations on the map on the date shown. */
      stations: StationSummary[];
      placeholder?: string;
      /** The end of a route it picks. */
      end: 'from' | 'to';
    }>(),
    { placeholder: 'Find a station' },
  );
  const emit = defineEmits<{ select: [station: string] }>();

  const query = ref('');
  const matches = computed(() =>
    findStations(props.stations, query.value, MAX_MATCHES).map(station => ({
      ...station,
      label: station.name,
      description: station.otherNames[0],
    })),
  );

  const choose = (item: { id: string } | undefined) => {
    if (!item) return;
    emit('select', item.id);
    query.value = '';
  };
</script>
