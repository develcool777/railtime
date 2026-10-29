<template>
  <div class="flex flex-wrap items-center gap-x-3.5 gap-y-1.5">
    <UButton
      icon="i-lucide-play"
      :label="hasPlan ? 'Play future' : 'Play history'"
      size="lg"
      class="flex-none font-semibold active:scale-[0.98]"
      @click="emit('play')" />
    <USlider
      v-if="hasHistory"
      class="min-w-[200px] flex-[1_1_300px]"
      :min="range.start"
      :max="range.end"
      :step="DAY_MS"
      :modelValue="time"
      aria-label="Show the network in a year"
      @update:modelValue="onSlide" />
    <span v-else class="flex-1" />
    <div class="flex flex-none gap-2">
      <UButton
        v-if="!isToday && hasHistory"
        label="Today"
        color="neutral"
        variant="outline"
        size="lg"
        class="font-semibold"
        @click="emit('seek', range.today)" />
      <UButton v-if="hasPlan && !isFuture" label="Future" color="neutral" variant="outline" size="lg" class="font-semibold" @click="emit('future')" />
    </div>
  </div>
</template>

<script setup lang="ts">
  import { DAY_MS } from '~/utils/explorer.constants';

  defineProps<{
    time: number;
    range: { start: number; end: number; today: number };
    isToday: boolean;
    /** Past today: a plan's future. */
    isFuture: boolean;
    /** A plan is shown: playing plays its future. */
    hasPlan: boolean;
    /** Something was built: a network never built has no years to slide through. */
    hasHistory: boolean;
  }>();
  const emit = defineEmits<{ play: []; seek: [time: number]; future: [] }>();

  const onSlide = (value: number | number[] | undefined) => {
    if (typeof value === 'number') emit('seek', value);
  };
</script>
