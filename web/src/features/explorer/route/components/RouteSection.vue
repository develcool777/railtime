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

    <p v-if="!ends.from || !ends.to" class="text-muted text-sm">Pick where the route starts and ends.</p>
    <p v-else-if="!route" class="text-muted text-sm">No route between them on the date shown.</p>
    <template v-else>
      <div class="flex flex-col gap-2">
        <div class="flex items-baseline justify-between gap-3">
          <p class="text-highlighted text-2xl leading-8 font-bold tabular-nums">{{ Math.round(route.minutes) }} min</p>
          <p class="text-muted text-xs tabular-nums">{{ summary }}</p>
        </div>
        <!-- The legs side by side, each as long as it takes: a line's colour for a ride, grey for a walk. -->
        <div class="flex h-1.5 gap-0.5" aria-hidden="true">
          <span
            v-for="(leg, position) in route.legs"
            :key="position"
            class="rounded-full"
            :class="{ 'bg-accented': leg.kind === 'walk' }"
            :style="{ flexGrow: leg.minutes, background: leg.kind === 'ride' ? leg.color : undefined }" />
        </div>
      </div>

      <!-- The legs as a track: a ring where each ride is boarded, its line down to the next, a dot at the end. -->
      <ol class="flex flex-col" role="list">
        <li v-for="(leg, position) in route.legs" :key="position" class="relative pb-4 pl-7">
          <template v-if="leg.kind === 'ride'">
            <span class="absolute top-2 -bottom-2 left-[5px] w-1 rounded-full" :style="{ background: leg.color }" />
            <span class="bg-default absolute top-0.5 left-0 size-3.5 rounded-full border-[3px]" :style="{ borderColor: leg.color }" />
            <div class="flex items-center justify-between gap-2">
              <button
                type="button"
                class="text-highlighted truncate text-left text-sm leading-5 font-semibold hover:underline"
                @click="emit('station', leg.stops[0]?.id ?? '')">
                {{ leg.stops[0]?.name }}
              </button>
              <span v-if="position > 0" class="eyebrow text-muted flex-none">Change</span>
            </div>
            <p class="text-default mt-0.5 text-xs">
              <span class="font-semibold">{{ leg.lineName }}</span>
              <span class="text-muted"> to {{ leg.stops.at(-1)?.name }}</span>
            </p>
            <button
              v-if="leg.stops.length > 2"
              type="button"
              class="text-muted hover:text-highlighted mt-1 flex items-center gap-1 text-xs tabular-nums"
              :aria-expanded="unfolded.has(position)"
              @click="toggle(position)">
              <UIcon name="i-lucide-chevron-right" class="size-3.5 transition-transform duration-150" :class="{ 'rotate-90': unfolded.has(position) }" />
              {{ rideText(leg) }}
            </button>
            <p v-else class="text-muted mt-1 text-xs tabular-nums">{{ rideText(leg) }}</p>
            <!-- The stops it passes, each a dot on its line. -->
            <ul v-if="unfolded.has(position)" class="mt-1" role="list">
              <li v-for="stop in leg.stops.slice(1, -1)" :key="stop.id" class="relative flex h-6 items-center">
                <span class="bg-default absolute -left-[26px] size-2.5 rounded-full border-2" :style="{ borderColor: leg.color }" />
                <button type="button" class="text-default truncate text-left text-xs hover:underline" @click="emit('station', stop.id)">{{ stop.name }}</button>
              </li>
            </ul>
          </template>
          <template v-else>
            <span class="border-accented absolute top-5 -bottom-1 left-[6px] border-l-2 border-dotted" />
            <UIcon name="i-lucide-footprints" class="text-muted absolute top-0.5 left-0 size-3.5" />
            <p class="text-default text-xs leading-5">
              Walk to <span class="font-semibold">{{ leg.to.name }}</span>
              <span class="text-muted tabular-nums"> · {{ Math.round(leg.minutes) }} min</span>
            </p>
          </template>
        </li>
        <li class="relative pl-7">
          <span class="absolute top-0.5 left-0 size-3.5 rounded-full bg-(--ui-text-highlighted)" />
          <button type="button" class="text-highlighted text-left text-sm leading-5 font-semibold hover:underline" @click="emit('station', route.to.id)">
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
  import { computed, ref, watch } from 'vue';

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

  /** "8 stops · 1 change · 12 km". */
  const summary = computed(() => {
    const route = props.route;
    if (!route) return '';
    const stops = route.legs.reduce((total, leg) => total + (leg.kind === 'ride' ? leg.stops.length - 1 : 0), 0);
    const unit = route.changes === 1 ? 'change' : 'changes';
    const changes = route.changes === 0 ? 'no change' : `${route.changes} ${unit}`;
    return `${stops} ${stops === 1 ? 'stop' : 'stops'} · ${changes} · ${Math.round(route.km)} km`;
  });

  // The rides whose stops are listed; a new route starts with them folded.
  const unfolded = ref(new Set<number>());
  watch(
    () => props.route,
    () => (unfolded.value = new Set()),
  );
  const toggle = (position: number) => {
    const next = new Set(unfolded.value);
    if (next.has(position)) next.delete(position);
    else next.add(position);
    unfolded.value = next;
  };

  /**
   * A ride, in a line.
   *
   * @param leg - The ride.
   * @returns "2 stops · 4 min".
   */
  const rideText = (leg: Extract<RouteLegInfo, { kind: 'ride' }>): string => {
    const stops = leg.stops.length - 1;
    return `${stops} ${stops === 1 ? 'stop' : 'stops'} · ${Math.round(leg.minutes)} min`;
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
