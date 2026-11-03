<template>
  <UInputMenu
    v-model:searchTerm="query"
    :modelValue="undefined"
    :items="matches"
    ignoreFilter
    openOnClick
    openOnFocus
    virtualize
    :highlight
    :placeholder
    variant="outline"
    class="w-full"
    :aria-label="placeholder"
    @focus="emit('focus')"
    @update:modelValue="choose">
    <!-- Where the route starts, hollow; where it ends, filled. -->
    <template #leading>
      <!-- In line with a picked end's dot, so the two read as one route. -->
      <span class="ml-0.5 size-2 rounded-full border-2 border-(--ui-text-highlighted)" :class="{ 'bg-(--ui-text-highlighted)': end === 'to' }" />
    </template>
    <template #item-leading="{ item }">
      <span class="flex w-[22px] flex-none items-center gap-0.5 self-center">
        <span v-for="color in item.colors" :key="`${color.light} ${color.dark}`" class="h-1.5 flex-1 rounded-full" :style="{ background: lineColor(color) }" />
      </span>
    </template>
    <template #empty>
      <span class="text-muted text-sm">No station on the map matches.</span>
    </template>
  </UInputMenu>
</template>

<script setup lang="ts">
  import type { StationSummary } from '@railtime/network/facts.types';
  import { computed, ref } from 'vue';

  import { stationChoices } from '~/features/explorer/stations/station.utils';
  import { lineColor } from '~/features/explorer/format.utils';

  const props = withDefaults(
    defineProps<{
      /** The stations on the map on the date shown. */
      stations: StationSummary[];
      placeholder?: string;
      /** The end of a route it picks. */
      end: 'from' | 'to';
      /** A station left out: the route's other end. */
      omit?: string | null;
      /** Ringed as if focused: the field a station clicked on the map fills. */
      highlight?: boolean;
    }>(),
    { placeholder: 'Find a station', omit: null, highlight: false },
  );
  const emit = defineEmits<{ select: [station: string]; focus: [] }>();

  const query = ref('');
  /** Every station A to Z as it opens, to scroll through; what the query finds once typed. */
  const matches = computed(() =>
    stationChoices(props.stations, query.value)
      .filter(station => station.id !== props.omit)
      .map(station => ({ ...station, label: station.name, description: station.otherNames[0] })),
  );

  const choose = (item: { id: string } | undefined) => {
    if (!item) return;
    emit('select', item.id);
    query.value = '';
  };
</script>
