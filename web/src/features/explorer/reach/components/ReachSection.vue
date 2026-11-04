<template>
  <div class="flex flex-col gap-4 px-4 pt-3 pb-6">
    <!-- A station clicked on the map always starts it: its field ringed, as Route's. -->
    <StationField :stations :stop="from" end="from" label="where it starts" placeholder="From" aimed @pick="emit('from', $event)" />
    <MapPickHint end="start" :picked="from !== null" class="-mt-2" />

    <UEmpty
      v-if="!from"
      key="unpicked"
      icon="i-lucide-radar"
      title="How far can you get?"
      description="Pick a station, here or on the map, to see how far you get from it and how long it takes." />
    <UEmpty v-else-if="!reach" key="unreached" icon="i-lucide-train-front" title="No line calls there" description="Not on the date shown." />
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
          <UCollapsible :open="unfolded.has(group.position)" :disabled="group.stations.length === 0" @update:open="toggle(group.position)">
            <ListRow class="group" :disabled="group.stations.length === 0">
              <span class="size-2.5 flex-none rounded-full" :style="{ background: group.band.color }" />
              <span class="text-highlighted flex-1 text-sm font-medium">{{ group.band.label }}</span>
              <span class="text-muted text-xs tabular-nums">{{ group.stations.length }}</span>
              <UIcon
                name="i-lucide-chevron-right"
                class="text-dimmed size-4 flex-none transition-transform duration-150 group-data-[state=open]:rotate-90"
                :class="{ invisible: group.stations.length === 0 }" />
            </ListRow>
            <template #content>
              <ul class="pb-2 pl-7" role="list">
                <li v-for="station in group.stations" :key="station.id">
                  <ListRow class="h-7" @click="emit('station', station.id)">
                    <span class="text-default min-w-0 flex-1 truncate text-xs">{{ station.name }}</span>
                    <span class="text-muted flex-none text-xs tabular-nums">{{ formatMinutes(station.minutes) }}</span>
                  </ListRow>
                </li>
              </ul>
            </template>
          </UCollapsible>
        </li>
      </ul>
      <p class="text-dimmed text-xs">
        Times are estimates from an average train speed, a few minutes for each change. Pick another date to see how far you got then.
      </p>
    </template>
  </div>
</template>

<script setup lang="ts">
  import type { ReachInfo, Stop, StationSummary } from '@railtime/network/facts.types';
  import type { StationId } from '@railtime/schema/network.types';
  import { computed, ref, watch } from 'vue';
  import { formatMinutes, reachGroups } from '~/features/explorer/reach/reach.utils';

  const props = defineProps<{
    /** The stations on the map on the date shown, to pick from. */
    stations: StationSummary[];
    /** The station the reach starts at, once picked. */
    from: Stop | null;
    /** Every station reached from it, if any. */
    reach: ReachInfo | null;
  }>();
  const emit = defineEmits<{ from: [stop: Stop | null]; station: [station: StationId] }>();

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
</script>
