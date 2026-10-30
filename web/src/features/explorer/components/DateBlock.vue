<template>
  <div
    :class="
      compact
        ? 'bg-default/95 border-default shadow-soft flex items-end gap-5 rounded-lg border px-4 py-3 backdrop-blur-sm'
        : 'border-muted flex flex-col gap-1.5 border-b px-6 pt-5 pb-4.5 max-sm:flex-row max-sm:items-end max-sm:justify-between max-sm:px-4 max-sm:pt-3 max-sm:pb-3'
    ">
    <div>
      <p class="eyebrow text-primary">{{ eyebrow }}</p>
      <p class="big-date text-highlighted font-extrabold tabular-nums" :class="{ playing: mode === 'history', compact }">{{ dateText }}</p>
      <p v-if="mode === 'history' && dateLabel && !compact" class="text-muted mt-1 text-[13px] tabular-nums max-sm:hidden">{{ dateLabel }}</p>
    </div>
    <dl v-if="time" class="flex gap-4.5 max-sm:gap-3" :class="{ 'mt-1.5 max-sm:mt-0': !compact }">
      <div v-for="stat in stats" :key="stat.label" class="flex flex-col-reverse">
        <dt class="text-muted text-xs">{{ stat.label }}</dt>
        <dd class="text-highlighted text-[17px] leading-tight font-bold tabular-nums max-sm:text-[15px]">{{ stat.value }}</dd>
      </div>
    </dl>
  </div>
</template>

<script setup lang="ts">
  import type { TimeState } from '@railtime/renderer/transitMap.types';
  import { computed } from 'vue';

  import { formatDay, formatMonth, yearOf } from '~/features/explorer/format.utils';

  const props = defineProps<{
    mode: 'explore' | 'history';
    time: TimeState | null;
    /** The plan shown, if any. */
    planName?: string;
    /** A step is playing: show its exact day. */
    stepActive: boolean;
    /** A card on the map, for when the panel is folded: one row, a smaller date. */
    compact?: boolean;
  }>();

  const isFuture = computed(() => props.time?.future === true);
  const isToday = computed(() => !props.time || (props.time.cursor === props.time.todayCursor && !isFuture.value));

  const eyebrow = computed(() => {
    if (props.mode === 'history') return props.planName ? 'Playing the future' : 'Playing history';
    return props.planName ? `Plan · ${props.planName}` : 'Exploring';
  });

  const dateText = computed(() => {
    if (isFuture.value) return 'Future';
    if (props.mode === 'explore' && isToday.value) return 'Today';
    return props.time ? String(yearOf(props.time.time)) : '';
  });

  const dateLabel = computed(() => {
    if (!props.time || isFuture.value) return '';
    return props.stepActive ? formatDay(props.time.time) : formatMonth(props.time.time);
  });

  const stats = computed(() => {
    const counts = props.time?.stats;
    if (!counts) return [];
    return [
      { label: counts.stations === 1 ? 'station' : 'stations', value: counts.stations },
      { label: 'km', value: Math.round(counts.km) },
      { label: counts.lines === 1 ? 'line' : 'lines', value: counts.lines },
    ];
  });
</script>

<style scoped>
  .big-date {
    font-size: 44px;
    letter-spacing: -0.03em;
    line-height: 1;
    transition: font-size 0.3s;
  }
  .big-date.playing {
    font-size: 64px;
  }
  .big-date.compact {
    font-size: 26px;
  }
  @media (width < 40rem) {
    .big-date,
    .big-date.playing {
      font-size: 32px;
    }
  }
</style>
