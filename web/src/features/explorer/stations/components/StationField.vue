<template>
  <!-- Ringed while a station clicked on the map fills it; a picked one, clicked, is aimed at again. -->
  <div
    v-if="stop"
    class="border-default bg-default flex h-9 min-w-0 items-center gap-2.5 rounded-lg border pr-1 pl-3 transition-shadow"
    :class="{ 'ring-primary ring-2 ring-inset': aimed }">
    <span
      class="relative size-2 flex-none rounded-full border-2 border-(--ui-text-highlighted)"
      :class="end === 'to' ? 'bg-(--ui-text-highlighted)' : 'bg-default'" />
    <button
      v-if="aimable"
      type="button"
      class="text-highlighted min-w-0 flex-1 cursor-pointer self-stretch truncate text-left text-sm font-medium"
      :aria-pressed="aimed"
      :title="`Pick ${label} on the map`"
      @click="emit('aim')">
      {{ stop.name }}
    </button>
    <span v-else class="text-highlighted min-w-0 flex-1 truncate text-sm font-medium">{{ stop.name }}</span>
    <UButton icon="i-lucide-x" color="neutral" variant="ghost" size="xs" :aria-label="`Clear ${label}`" @click="emit('pick', null)" />
  </div>
  <StationSearch v-else :stations :placeholder :end :omit :highlight="aimed" @focus="emit('aim')" @select="choose" />
</template>

<script setup lang="ts">
  import type { Stop, StationSummary } from '@railtime/network/facts.types';

  const props = withDefaults(
    defineProps<{
      /** The stations on the map on the date shown, to pick from. */
      stations: StationSummary[];
      /** The station picked, or `null` to search for one. */
      stop: Stop | null;
      /** Where a route starts, a hollow dot; where it ends, a filled one. */
      end: 'from' | 'to';
      /** What the field is for, as its buttons say it ("from", "the station"). */
      label: string;
      placeholder: string;
      /** A station left out of the search: a route's other end. */
      omit?: string | null;
      /** A station clicked on the map fills this field. */
      aimed?: boolean;
      /** The picked station's name, clicked, aims the map at this field: where there is another to aim at. */
      aimable?: boolean;
    }>(),
    { omit: null, aimed: false, aimable: false },
  );
  const emit = defineEmits<{ pick: [stop: Stop | null]; aim: [] }>();

  /** Picks a station found in the search. */
  const choose = (id: string) => {
    const station = props.stations.find(candidate => candidate.id === id);
    if (station) emit('pick', { id, name: station.name });
  };
</script>
