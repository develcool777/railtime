<template>
  <div class="flex flex-col gap-4 px-4 pt-3 pb-6">
    <!-- Where it starts and ends, joined as on a ticket; swapped beside them. -->
    <div class="flex items-center gap-2">
      <div class="relative flex min-w-0 flex-1 flex-col gap-2">
        <span class="border-accented pointer-events-none absolute top-[22px] bottom-[22px] left-[16px] border-l-2 border-dotted" aria-hidden="true" />
        <StationField
          v-for="end in ENDS"
          :key="end.key"
          :stations
          :stop="ends[end.key]"
          :end="end.key"
          :label="end.label"
          :placeholder="end.placeholder"
          :omit="ends[end.key === 'from' ? 'to' : 'from']?.id"
          :aimed="aim === end.key"
          aimable
          @aim="emit('aim', end.key)"
          @pick="emit('end', end.key, $event)" />
      </div>
      <UTooltip text="Swap">
        <UButton
          icon="i-lucide-arrow-up-down"
          color="neutral"
          variant="ghost"
          square
          class="size-8 flex-none"
          aria-label="Swap from and to"
          @click="emit('swap')" />
      </UTooltip>
    </div>
    <!-- Which end the map fills, as the ring shows; and both ends cleared at once. -->
    <MapPickHint :end="aim === 'from' ? 'start' : 'end'" :picked="!!ends[aim]" class="-mt-2">
      <UButton
        v-if="ends.from || ends.to"
        label="Clear"
        icon="i-lucide-rotate-ccw"
        color="neutral"
        variant="link"
        size="xs"
        class="flex-none"
        @click="emit('clear')" />
    </MapPickHint>

    <UEmpty
      v-if="!ends.from || !ends.to"
      icon="i-lucide-route"
      title="Plan a route"
      description="Pick two stations, here or on the map, for the ways between them." />
    <UEmpty v-else-if="!found || found.shown === null" icon="i-lucide-route-off" title="No route" description="Nothing runs between them on the date shown." />
    <template v-else>
      <!-- The ways between them, fastest first: each its time and how it compares; the one drawn opens to where it changes and its steps. -->
      <ul class="flex flex-col gap-2" role="list" aria-label="Ways between them">
        <li
          v-for="(route, position) in found.routes"
          :key="position"
          class="overflow-hidden rounded-lg border transition-colors"
          :class="position === found.shown ? 'border-primary bg-elevated/40' : 'border-default'">
          <button
            type="button"
            class="hover:bg-elevated/60 flex w-full flex-col gap-2 px-3 py-2.5 text-left transition-colors"
            :aria-expanded="position === found.shown"
            @click="emit('option', position)">
            <span class="flex items-center justify-between gap-2">
              <span class="text-highlighted text-lg leading-6 font-bold tabular-nums">{{ Math.round(route.minutes) }} min</span>
              <span v-if="route.best.length > 0" class="flex gap-1">
                <UBadge
                  v-for="strength in routeStrengths(route)"
                  :key="strength.label"
                  :label="strength.label"
                  :color="strength.color"
                  variant="subtle"
                  size="sm" />
              </span>
              <span v-else-if="fastest" class="text-muted text-xs tabular-nums">{{ routeDifference(route, fastest) }}</span>
            </span>
            <!-- Its legs side by side, each as long as it takes: a ride in its line's colour, a walk dashed. -->
            <span class="flex h-1.5 gap-0.5" aria-hidden="true">
              <span
                v-for="(leg, legPosition) in route.legs"
                :key="legPosition"
                class="rounded-full"
                :class="{ walk: leg.kind === 'walk' }"
                :style="{ flexGrow: leg.minutes, background: leg.kind === 'ride' ? lineColor(leg.color) : undefined }" />
            </span>
            <span v-if="position === found.shown" class="text-default truncate text-xs">
              {{ routeVia(route) }} <span class="text-dimmed tabular-nums">· {{ routeSummary(route) }}</span>
            </span>
          </button>
          <!-- The way drawn opens to its steps, in the same card. -->
          <RouteSteps v-if="position === found.shown" :route class="border-default border-t px-3 pt-3 pb-3" @station="emit('station', $event)" />
        </li>
      </ul>

      <p class="text-dimmed text-xs">Times are estimates from an average train speed, a few minutes for each change.</p>
    </template>
  </div>
</template>

<script setup lang="ts">
  import type { RouteInfo, Stop, StationSummary } from '@railtime/network/facts.types';
  import { computed } from 'vue';

  import { lineColor } from '~/features/explorer/format.utils';
  import { routeDifference, routeStrengths, routeSummary, routeVia } from '~/features/explorer/route/route.utils';
  import type { RouteEnds } from '~/features/explorer/tools.types';

  const ENDS = [
    { key: 'from', label: 'from', placeholder: 'From' },
    { key: 'to', label: 'to', placeholder: 'To' },
  ] as const;

  const props = defineProps<{
    /** The stations on the map on the date shown, to pick from. */
    stations: StationSummary[];
    /** Where the route starts and ends, once picked. */
    ends: RouteEnds;
    /** The end a station clicked on the map fills. */
    aim: keyof RouteEnds;
    /** The ways between them on the date shown, fastest first, and the one drawn; `null` while none is drawn. */
    found: { routes: RouteInfo[]; shown: number | null } | null;
  }>();
  const emit = defineEmits<{
    end: [end: keyof RouteEnds, stop: Stop | null];
    aim: [end: keyof RouteEnds];
    clear: [];
    swap: [];
    option: [option: number];
    station: [station: string];
  }>();

  /** The fastest way, which the others are told against. */
  const fastest = computed(() => props.found?.routes[0] ?? null);
</script>

<style scoped>
  /* A walk between lines: dashed, as the steps draw it, not a gap. */
  .walk {
    background: repeating-linear-gradient(90deg, var(--ui-border-accented) 0 3px, transparent 3px 6px);
  }
</style>
