<template>
  <div class="flex flex-col gap-4 px-4 pt-3 pb-6">
    <div class="flex items-center gap-2">
      <div class="flex min-w-0 flex-1 flex-col gap-2">
        <template v-for="end in ENDS" :key="end.key">
          <div v-if="ends[end.key]" class="border-default bg-default flex h-9 min-w-0 items-center gap-2.5 rounded-lg border pr-1 pl-3">
            <span class="size-2 flex-none rounded-full border-2 border-(--ui-text-highlighted)" :class="{ 'bg-(--ui-text-highlighted)': end.key === 'to' }" />
            <span class="text-highlighted min-w-0 flex-1 truncate text-sm font-medium">{{ ends[end.key]?.name }}</span>
            <UButton icon="i-lucide-x" color="neutral" variant="ghost" size="xs" :aria-label="`Clear ${end.label}`" @click="clear(end.key)" />
          </div>
          <StationSearch v-else :stations :placeholder="end.placeholder" :end="end.key" @select="choose(end.key, $event)" />
        </template>
      </div>
      <UTooltip text="Swap">
        <UButton
          icon="i-lucide-arrow-up-down"
          color="neutral"
          variant="outline"
          square
          class="size-8 flex-none"
          aria-label="Swap from and to"
          @click="emit('swap')" />
      </UTooltip>
    </div>

    <SegmentedControl
      :modelValue="preference"
      :items="PREFERENCES"
      label="Route preference"
      class="self-start"
      @update:modelValue="emit('preference', $event)" />

    <p v-if="!ends.from || !ends.to" class="text-muted text-sm">Pick two stations, here or from a station's view.</p>
    <p v-else-if="!route" class="text-muted text-sm">No route between them on the date shown.</p>
    <template v-else>
      <div>
        <p class="text-highlighted text-lg leading-6 font-bold tabular-nums">{{ Math.round(route.minutes) }} min</p>
        <p class="text-muted text-xs tabular-nums">{{ summary }}</p>
      </div>
      <!-- The legs as a track: a ring where each is boarded, its line down to the next, a dot at the end. -->
      <ol class="flex flex-col" role="list">
        <li v-for="(leg, position) in route.legs" :key="position" class="flex gap-3">
          <span class="flex w-3 flex-none flex-col items-center">
            <template v-if="leg.kind === 'ride'">
              <span class="bg-default mt-1 size-3 flex-none rounded-full border-[3px]" :style="{ borderColor: leg.color }" />
              <span class="w-1 flex-1 rounded-full" :style="{ background: leg.color }" />
            </template>
            <template v-else>
              <UIcon name="i-lucide-footprints" class="text-muted mt-0.5 size-3 flex-none" />
              <span class="border-accented w-0 flex-1 border-l-2 border-dotted" />
            </template>
          </span>
          <div class="min-w-0 flex-1 pb-4">
            <template v-if="leg.kind === 'ride'">
              <button
                type="button"
                class="text-highlighted block text-left text-sm font-semibold hover:underline"
                @click="emit('station', leg.stops[0]?.id ?? '')">
                {{ leg.stops[0]?.name }}
              </button>
              <p class="text-muted text-xs">{{ rideText(leg) }}</p>
            </template>
            <p v-else class="text-muted text-xs">Walk to {{ leg.to.name }} · {{ Math.round(leg.minutes) }} min</p>
          </div>
        </li>
        <li class="flex gap-3">
          <span class="flex w-3 flex-none justify-center">
            <span class="mt-1 size-3 rounded-full bg-(--ui-text-highlighted)" />
          </span>
          <button type="button" class="text-highlighted text-left text-sm font-semibold hover:underline" @click="emit('station', route.to.id)">
            {{ route.to.name }}
          </button>
        </li>
      </ol>
      <p class="text-dimmed text-xs">Times are estimates from an average train speed, a few minutes for each change.</p>
    </template>
  </div>
</template>

<script setup lang="ts">
  import type { RouteInfo, RouteLegInfo, RoutePreference, RouteStop, StationSummary } from '@railtime/renderer/transitMap.types';
  import { computed } from 'vue';

  const ENDS = [
    { key: 'from', label: 'from', placeholder: 'From' },
    { key: 'to', label: 'to', placeholder: 'To' },
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

  /** "8 stops · 1 change". */
  const summary = computed(() => {
    const route = props.route;
    if (!route) return '';
    const stops = route.legs.reduce((total, leg) => total + (leg.kind === 'ride' ? leg.stops.length - 1 : 0), 0);
    const unit = route.changes === 1 ? 'change' : 'changes';
    const changes = route.changes === 0 ? 'no change' : `${route.changes} ${unit}`;
    return `${stops} ${stops === 1 ? 'stop' : 'stops'} · ${changes}`;
  });

  /**
   * A ride, in a line.
   *
   * @param leg - The ride.
   * @returns "Bakerloo line · 2 stops to Oxford Circus".
   */
  const rideText = (leg: Extract<RouteLegInfo, { kind: 'ride' }>): string => {
    const stops = leg.stops.length - 1;
    return `${leg.lineName} · ${stops} ${stops === 1 ? 'stop' : 'stops'} to ${leg.stops.at(-1)?.name ?? ''}`;
  };

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
