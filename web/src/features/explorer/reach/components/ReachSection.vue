<template>
  <div class="flex flex-col gap-4 px-4 pt-3 pb-6">
    <div v-if="from" class="border-default bg-default flex h-9 min-w-0 items-center gap-2.5 rounded-lg border pr-1 pl-3">
      <span class="size-2 flex-none rounded-full border-2 border-(--ui-text-highlighted)" />
      <span class="text-highlighted min-w-0 flex-1 truncate text-sm font-medium">{{ from.name }}</span>
      <UButton icon="i-lucide-x" color="neutral" variant="ghost" size="xs" aria-label="Clear the station" @click="emit('from', null)" />
    </div>
    <StationSearch v-else :stations placeholder="From" end="from" @select="choose" />

    <p v-if="!from" class="text-muted text-sm">Pick a station to see how far you get from it, and how long it takes.</p>
    <p v-else-if="!reach" class="text-muted text-sm">No line calls there on the date shown.</p>
    <template v-else>
      <div class="flex flex-col gap-2">
        <div class="flex items-baseline justify-between gap-3">
          <p class="text-highlighted text-2xl leading-8 font-bold tabular-nums">{{ reach.stations.length }} stations</p>
          <p v-if="farthest" class="text-muted text-xs tabular-nums">all within {{ formatMinutes(farthest.minutes) }}</p>
        </div>
        <!-- The bands side by side, each as wide as the stations in it. -->
        <div class="flex h-1.5 gap-0.5" aria-hidden="true">
          <span
            v-for="group in groups.filter(entry => entry.stations.length > 0)"
            :key="group.position"
            class="rounded-full"
            :style="{ flexGrow: group.stations.length, background: group.band.color }" />
        </div>
      </div>

      <!-- Each band, its stations listed on request, the nearest open. -->
      <ul class="flex flex-col" role="list">
        <li v-for="group in groups" :key="group.position">
          <button
            type="button"
            class="hover:bg-elevated flex h-9 w-full items-center gap-2.5 rounded-md px-2 text-left transition-colors duration-150 disabled:opacity-50"
            :disabled="group.stations.length === 0"
            :aria-expanded="unfolded.has(group.position)"
            @click="toggle(group.position)">
            <span class="size-2.5 flex-none rounded-full" :style="{ background: group.band.color }" />
            <span class="text-highlighted flex-1 text-sm font-medium">{{ group.band.label }}</span>
            <span class="text-muted text-xs tabular-nums">{{ group.stations.length }}</span>
            <UIcon
              name="i-lucide-chevron-right"
              class="text-dimmed size-4 flex-none transition-transform duration-150"
              :class="{ 'rotate-90': unfolded.has(group.position), invisible: group.stations.length === 0 }" />
          </button>
          <ul v-if="unfolded.has(group.position)" class="pb-2 pl-7" role="list">
            <li v-for="station in group.stations" :key="station.id">
              <button
                type="button"
                class="hover:bg-elevated flex h-7 w-full items-center justify-between gap-2 rounded-md px-2 text-left"
                @click="emit('station', station.id)">
                <span class="text-default truncate text-xs">{{ station.name }}</span>
                <span class="text-muted flex-none text-xs tabular-nums">{{ formatMinutes(station.minutes) }}</span>
              </button>
            </li>
          </ul>
        </li>
      </ul>
      <p class="text-dimmed text-xs">
        Times are estimates from an average train speed, a few minutes for each change. Pick another date to see how far you got then.
      </p>
    </template>
  </div>
</template>

<script setup lang="ts">
  import type { ReachInfo, RouteStop, StationSummary } from '@railtime/renderer/transitMap.types';
  import { computed, ref, watch } from 'vue';

  import { formatMinutes, reachGroups } from '~/features/explorer/reach/reach.utils';

  const props = defineProps<{
    /** The stations on the map on the date shown, to pick from. */
    stations: StationSummary[];
    /** The station the reach starts at, once picked. */
    from: RouteStop | null;
    /** Every station reached from it, if any. */
    reach: ReachInfo | null;
  }>();
  const emit = defineEmits<{ from: [stop: RouteStop | null]; station: [station: string] }>();

  const groups = computed(() => (props.reach ? reachGroups(props.reach) : []));
  const farthest = computed(() => props.reach?.stations.at(-1));

  // The bands whose stations are listed; a new start opens on the nearest.
  const unfolded = ref(new Set<number>([0]));
  watch(
    () => props.from?.id,
    () => (unfolded.value = new Set([0])),
  );
  const toggle = (position: number) => {
    const next = new Set(unfolded.value);
    if (next.has(position)) next.delete(position);
    else next.add(position);
    unfolded.value = next;
  };

  /** Starts the reach at a station picked in the search. */
  const choose = (id: string) => {
    const station = props.stations.find(candidate => candidate.id === id);
    if (station) emit('from', { id, name: station.name });
  };
</script>
