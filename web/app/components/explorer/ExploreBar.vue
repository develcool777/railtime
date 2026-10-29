<template>
  <div class="flex items-center gap-3 rounded-xl border border-default bg-default/85 px-3 py-2 shadow-lg backdrop-blur">
    <UButton icon="i-lucide-play" :label="hasPlan ? 'Play future' : 'Play history'" class="flex-none" @click="emit('playHistory')" />
    <span class="text-muted w-12 flex-none text-right text-sm tabular-nums">{{ isFuture ? 'Future' : yearOf(time) }}</span>
    <USlider
      class="min-w-0 flex-1"
      :min="range.start"
      :max="range.end"
      :step="DAY_MS"
      :modelValue="time"
      aria-label="Show the network in a year"
      @update:modelValue="onSlide" />
    <UButton v-if="!isToday" label="Today" color="neutral" variant="outline" class="flex-none" @click="emit('seek', range.today)" />
    <UButton v-if="hasPlan && !isFuture" label="Future" color="neutral" variant="outline" class="flex-none" @click="emit('future')" />
    <UColorModeButton class="flex-none" />
  </div>
</template>

<script setup lang="ts">
  import { DAY_MS } from '~/utils/explorer.constants';
  import { yearOf } from '~/utils/format.utils';

  defineProps<{
    time: number;
    range: { start: number; end: number; today: number };
    isToday: boolean;
    /** Past today: a plan's future. */
    isFuture: boolean;
    /** A plan is shown: playing plays its future. */
    hasPlan: boolean;
  }>();
  const emit = defineEmits<{ playHistory: []; seek: [time: number]; future: [] }>();

  const onSlide = (value: number | number[] | undefined) => {
    if (typeof value === 'number') emit('seek', value);
  };
</script>
