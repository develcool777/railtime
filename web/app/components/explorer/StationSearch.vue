<template>
  <UInputMenu
    v-model:searchTerm="query"
    :modelValue="undefined"
    :items="matches"
    ignoreFilter
    icon="i-lucide-search"
    :placeholder
    size="lg"
    variant="soft"
    class="w-full"
    :aria-label="placeholder"
    @update:modelValue="choose">
    <template #item-leading="{ item }">
      <span class="flex w-[22px] flex-none gap-0.5">
        <span v-for="color in item.colors" :key="color" class="h-1.5 flex-1 rounded-full" :style="{ background: color }" />
      </span>
    </template>
    <template #empty>
      <span class="text-muted text-sm">{{ query.trim() ? 'No station on the map matches.' : 'Type a station’s name.' }}</span>
    </template>
  </UInputMenu>
</template>

<script setup lang="ts">
  import type { StationSummary } from '@railtime/renderer/transitMap.types';
  import { computed, ref } from 'vue';

  import { findStations } from '~/utils/station.utils';

  /** How many matches the menu lists. */
  const MAX_MATCHES = 30;

  const props = withDefaults(
    defineProps<{
      /** The stations on the map on the date shown. */
      stations: StationSummary[];
      placeholder?: string;
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
