<template>
  <div class="flex flex-col gap-4 px-4 pt-3 pb-6">
    <UInput
      v-model="query"
      icon="i-lucide-list-filter"
      placeholder="Filter stations"
      variant="none"
      class="w-full"
      :ui="{ base: 'bg-muted ring-muted focus-visible:ring-primary h-9 rounded-lg ring ring-inset focus-visible:ring-2' }"
      aria-label="Filter stations" />
    <p v-if="stations.length === 0" class="text-muted text-sm">No station is open on the date shown.</p>
    <p v-else-if="groups.length === 0" class="text-muted text-sm">No station matches.</p>
    <section v-for="group in groups" :key="group.letter">
      <h3 v-if="group.letter" class="eyebrow text-muted px-2 pb-1">{{ group.letter }}</h3>
      <ul role="list" class="-mx-2">
        <li v-for="station in group.stations" :key="station.id">
          <button
            type="button"
            class="hover:bg-elevated flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-left transition-colors duration-150"
            @click="emit('open', station.id)">
            <span class="flex w-[22px] flex-none flex-wrap gap-0.5">
              <span v-for="color in station.colors" :key="color" class="size-1.5 rounded-full" :style="{ background: color }" />
            </span>
            <span class="text-highlighted min-w-0 flex-1 truncate text-sm font-medium">{{ station.name }}</span>
            <span v-if="station.otherNames[0]" class="text-muted max-w-[40%] flex-none truncate text-xs">{{ station.otherNames[0] }}</span>
          </button>
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup lang="ts">
  import type { StationSummary } from '@railtime/renderer/transitMap.types';
  import { computed, ref } from 'vue';

  import type { StationGroup } from '~/features/explorer/stations/station.types';
  import { findStations, stationsByLetter } from '~/features/explorer/stations/station.utils';

  const props = defineProps<{
    /** The stations on the map on the date shown. */
    stations: StationSummary[];
  }>();
  const emit = defineEmits<{ open: [station: string] }>();

  const query = ref('');
  /** A to Z under their letters; filtered, the best matches first, under no letter. */
  const groups = computed((): StationGroup[] => {
    if (!query.value.trim()) return stationsByLetter(props.stations);
    const found = findStations(props.stations, query.value, props.stations.length);
    return found.length > 0 ? [{ letter: '', stations: found }] : [];
  });
</script>
