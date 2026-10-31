<template>
  <div class="flex flex-col gap-4 px-4 pt-3 pb-6">
    <UInput v-model="query" icon="i-lucide-search" placeholder="Search stations" variant="soft" class="w-full" aria-label="Search stations" />
    <UEmpty v-if="stations.length === 0" icon="i-lucide-map-pin-off" title="No station open" description="None is open on the date shown." />
    <UEmpty v-else-if="groups.length === 0" icon="i-lucide-search-x" title="No station matches" description="Try another name." />
    <section v-for="group in groups" :key="group.letter">
      <h3 v-if="group.letter" class="eyebrow text-muted px-2 pb-1">{{ group.letter }}</h3>
      <ul role="list" class="-mx-2">
        <li v-for="station in group.stations" :key="station.id">
          <ListRow @click="emit('open', station.id)">
            <span class="flex w-[22px] flex-none flex-wrap gap-0.5">
              <span v-for="color in station.colors" :key="color" class="size-1.5 rounded-full" :style="{ background: color }" />
            </span>
            <span class="text-highlighted min-w-0 flex-1 truncate text-sm font-medium">{{ station.name }}</span>
            <span v-if="station.otherNames[0]" class="text-muted max-w-[40%] flex-none truncate text-xs">{{ station.otherNames[0] }}</span>
          </ListRow>
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
  /** A to Z under their letters; searched, the best matches first, under no letter. */
  const groups = computed((): StationGroup[] => {
    if (!query.value.trim()) return stationsByLetter(props.stations);
    const found = findStations(props.stations, query.value, props.stations.length);
    return found.length > 0 ? [{ letter: '', stations: found }] : [];
  });
</script>
