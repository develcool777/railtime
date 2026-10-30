<template>
  <div class="flex flex-col gap-3 px-4 pt-3.5 pb-6">
    <div class="flex items-stretch gap-2">
      <div class="flex min-w-0 flex-1 flex-col gap-2">
        <div v-for="end in ENDS" :key="end.key" class="flex items-center gap-2">
          <span class="text-muted w-9 flex-none text-xs font-semibold">{{ end.label }}</span>
          <div v-if="ends[end.key]" class="border-default bg-default flex min-w-0 flex-1 items-center gap-2 rounded-md border py-1.5 pr-1 pl-3">
            <span class="text-highlighted min-w-0 flex-1 truncate text-sm font-medium">{{ ends[end.key]?.name }}</span>
            <UButton icon="i-lucide-x" color="neutral" variant="ghost" size="xs" :aria-label="`Clear ${end.label.toLowerCase()}`" @click="clear(end.key)" />
          </div>
          <StationSearch v-else class="min-w-0 flex-1" :stations :placeholder="end.placeholder" @select="choose(end.key, $event)" />
        </div>
      </div>
      <UTooltip text="Swap">
        <UButton icon="i-lucide-arrow-up-down" color="neutral" variant="ghost" class="self-center" aria-label="Swap from and to" @click="emit('swap')" />
      </UTooltip>
    </div>

    <SegmentedControl
      :modelValue="preference"
      :items="PREFERENCES"
      label="Route preference"
      class="self-start"
      @update:modelValue="emit('preference', $event)" />

    <p v-if="!ends.from || !ends.to" class="text-muted text-sm">Pick two stations, here or from a station's panel.</p>
    <p v-else-if="!route" class="text-muted text-sm">No route between them on the date shown.</p>
    <template v-else>
      <div class="border-muted border-b pb-3">
        <p class="text-highlighted text-xl font-bold tabular-nums">about {{ Math.round(route.minutes) }} min</p>
        <p class="text-muted text-[13px]">
          {{ route.changes === 0 ? 'no change' : `${route.changes} ${route.changes === 1 ? 'change' : 'changes'}` }} · {{ route.km.toFixed(1) }} km
        </p>
      </div>
      <ol class="flex flex-col gap-3" role="list">
        <li v-for="(leg, position) in route.legs" :key="position" class="flex gap-3">
          <template v-if="leg.kind === 'ride'">
            <span class="w-1.5 flex-none rounded-full" :style="{ background: leg.color }" />
            <div class="min-w-0 flex-1">
              <p class="text-highlighted text-sm font-semibold">{{ leg.lineName }}</p>
              <button type="button" class="text-default hover:text-highlighted block text-left text-[13px]" @click="emit('station', leg.stops[0]?.id ?? '')">
                {{ leg.stops[0]?.name }}
              </button>
              <details v-if="leg.stops.length > 2" class="text-muted text-xs">
                <summary class="py-0.5">{{ leg.stops.length - 1 }} stops · {{ Math.round(leg.minutes) }} min</summary>
                <ul role="list" class="border-default my-1 ml-1 border-l pl-2">
                  <li v-for="stop in leg.stops.slice(1, -1)" :key="stop.id">{{ stop.name }}</li>
                </ul>
              </details>
              <p v-else class="text-muted py-0.5 text-xs">1 stop · {{ Math.round(leg.minutes) }} min</p>
              <button
                type="button"
                class="text-default hover:text-highlighted block text-left text-[13px]"
                @click="emit('station', leg.stops[leg.stops.length - 1]?.id ?? '')">
                {{ leg.stops[leg.stops.length - 1]?.name }}
              </button>
            </div>
          </template>
          <template v-else>
            <UIcon name="i-lucide-footprints" class="text-muted size-4 flex-none" />
            <p class="text-muted text-[13px]">Walk to {{ leg.to.name }} · {{ Math.round(leg.minutes) }} min</p>
          </template>
        </li>
      </ol>
      <p class="text-dimmed text-xs">Times are estimates from an average train speed, a few minutes for each change.</p>
    </template>
  </div>
</template>

<script setup lang="ts">
  import type { RouteInfo, RoutePreference, RouteStop, StationSummary } from '@railtime/renderer/transitMap.types';

  const ENDS = [
    { key: 'from', label: 'From', placeholder: 'Start at…' },
    { key: 'to', label: 'To', placeholder: 'Go to…' },
  ] as const;
  const PREFERENCES: { label: string; value: RoutePreference }[] = [
    { label: 'Fastest', value: 'fastest' },
    { label: 'Fewer changes', value: 'fewer-changes' },
  ];

  const props = defineProps<{
    /** The stations on the map on the date shown, to pick from. */
    stations: StationSummary[];
    /** Where the route starts and ends, once picked. */
    ends: { from: RouteStop | null; to: RouteStop | null };
    preference: RoutePreference;
    /** The route between them, if there is one. */
    route: RouteInfo | null;
  }>();
  const emit = defineEmits<{
    from: [stop: RouteStop | null];
    to: [stop: RouteStop | null];
    swap: [];
    preference: [preference: RoutePreference];
    station: [station: string];
  }>();

  /** Clears one end. */
  const clear = (end: 'from' | 'to') => (end === 'from' ? emit('from', null) : emit('to', null));

  /** Sets one end from a station picked in the search. */
  const choose = (end: 'from' | 'to', id: string) => {
    const station = props.stations.find(candidate => candidate.id === id);
    if (!station) return;
    if (end === 'from') emit('from', { id, name: station.name });
    else emit('to', { id, name: station.name });
  };
</script>
