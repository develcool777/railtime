<template>
  <!-- The station, chosen from the list a click opens, picked or not; beside it, aiming the map at this field. -->
  <UFieldGroup class="w-full min-w-0">
    <UInputMenu
      v-model:searchTerm="query"
      :modelValue="chosen"
      :items="matches"
      by="id"
      ignoreFilter
      openOnClick
      openOnFocus
      virtualize
      clear
      :highlight="aimed"
      :placeholder
      variant="outline"
      class="min-w-0 flex-1"
      :ui="{ base: stop ? 'text-highlighted font-medium' : undefined }"
      :aria-label="placeholder"
      spellcheck="false"
      autocomplete="off"
      @focus="emit('aim')"
      @clear="emit('pick', null)"
      @update:modelValue="choose">
      <!-- Where a route starts, hollow; where it ends, filled: in line with the dotted join between them. -->
      <template #leading>
        <span class="ml-0.5 size-2 rounded-full border-2 border-(--ui-text-highlighted)" :class="{ 'bg-(--ui-text-highlighted)': end === 'to' }" />
      </template>
      <template #item-leading="{ item }">
        <span class="flex w-[22px] flex-none items-center gap-0.5 self-center">
          <span
            v-for="color in item.colors"
            :key="`${color.light} ${color.dark}`"
            class="h-1.5 flex-1 rounded-full"
            :style="{ background: lineColor(color) }" />
        </span>
      </template>
      <template #empty>
        <span class="text-muted text-sm">No station on the map matches.</span>
      </template>
    </UInputMenu>
    <UTooltip v-if="aimable" :text="aimed ? `A station clicked on the map is ${label}` : `Pick ${label} on the map`">
      <UButton
        icon="i-lucide-crosshair"
        :color="aimed ? 'primary' : 'neutral'"
        :variant="aimed ? 'solid' : 'outline'"
        square
        :aria-pressed="aimed"
        :aria-label="`Pick ${label} on the map`"
        @click="emit('aim')" />
    </UTooltip>
  </UFieldGroup>
</template>

<script setup lang="ts">
  import type { Stop, StationSummary } from '@railtime/network/facts.types';
  import { computed, ref } from 'vue';
  import type { StationChoice } from '~/features/explorer/stations/station.types';
  import { stationChoices } from '~/features/explorer/stations/station.utils';
  import { lineColor } from '~/utils/format.utils';

  const props = withDefaults(
    defineProps<{
      /** The stations on the map on the date shown, to pick from. */
      stations: StationSummary[];
      /** The station picked, or `null`. */
      stop: Stop | null;
      /** Where a route starts, a hollow dot; where it ends, a filled one. */
      end: 'from' | 'to';
      /** What the field is for, as its button says it ("where it starts"). */
      label: string;
      placeholder: string;
      /** A station left out of the list: a route's other end. */
      omit?: string | null;
      /** A station clicked on the map fills this field: ringed, its button pressed. */
      aimed?: boolean;
      /** A button beside it aims the map at this field: where there is another field to aim at. */
      aimable?: boolean;
    }>(),
    { omit: null, aimed: false, aimable: false },
  );
  const emit = defineEmits<{ pick: [stop: Stop | null]; aim: [] }>();

  const query = ref('');
  /** The station picked, named as the field shows it: whether the list holds it yet or not. */
  const chosen = computed((): StationChoice | undefined => (props.stop ? { id: props.stop.id, label: props.stop.name, colors: [] } : undefined));
  /** Every station A to Z as it opens, to scroll through; what the query finds once typed. */
  const matches = computed((): StationChoice[] =>
    stationChoices(props.stations, query.value)
      .filter(station => station.id !== props.omit)
      .map(station => ({ id: station.id, label: station.name, description: station.otherNames[0], colors: station.colors })),
  );

  /**
   * Picks a station chosen from the list.
   *
   * @param item - The station, or `null` for the field cleared.
   */
  const choose = (item: StationChoice | null) => {
    if (item) emit('pick', { id: item.id, name: item.label });
    query.value = '';
  };
</script>
