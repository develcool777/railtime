<template>
  <div class="text-over-map pointer-events-none select-none">
    <p v-if="mode === 'explore'" class="text-highlighted text-4xl font-bold tracking-tight">
      {{ isToday ? 'Today' : year }}<span v-if="isPlanned" class="text-muted ml-2 text-base font-medium tracking-normal">planned</span>
    </p>
    <template v-else>
      <p class="text-highlighted text-6xl leading-none font-bold tracking-tighter tabular-nums sm:text-8xl">{{ year }}</p>
      <p class="text-muted mt-1 h-5 text-sm">{{ dateLabel }}{{ isPlanned ? ' · planned' : '' }}</p>
    </template>
    <p v-if="time" class="text-muted mt-1 text-[13px] tabular-nums">{{ formatStats(time.stats) }}</p>
  </div>
</template>

<script setup lang="ts">
  import type { TimeState } from '@railtime/renderer/transitMap.types';
  import { computed } from 'vue';

  import { formatDay, formatMonth, formatStats, yearOf } from '~/utils/format.utils';

  const props = defineProps<{
    mode: 'explore' | 'history';
    time: TimeState | null;
    /** A step is playing: show its exact day. */
    stepActive: boolean;
  }>();

  const year = computed(() => (props.time ? yearOf(props.time.time) : ''));
  const isToday = computed(() => !props.time || props.time.cursor === props.time.todayCursor);
  const isPlanned = computed(() => !!props.time && props.time.cursor > props.time.todayCursor);
  const dateLabel = computed(() => {
    if (!props.time) return '';
    return props.stepActive ? formatDay(props.time.time) : formatMonth(props.time.time);
  });
</script>
