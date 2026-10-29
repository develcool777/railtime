<template>
  <Transition name="step-card">
    <UCard
      v-if="step"
      :key="step.title + step.time"
      class="w-[min(380px,calc(100vw-32px))] overflow-hidden bg-default/85 backdrop-blur"
      :ui="{ body: 'p-0 sm:p-0' }">
      <div class="h-1.5" :style="{ background: step.color }" />
      <div class="px-4 py-3">
        <p class="text-muted text-xs">{{ step.time === null ? 'Future' : formatDay(step.time) }}</p>
        <p class="text-highlighted mt-0.5 text-base leading-snug font-semibold">{{ step.title }}</p>
        <p v-if="step.subtitle" class="text-muted text-sm">{{ step.subtitle }}</p>
        <ul v-if="shownStations.length" class="mt-2 flex flex-wrap gap-1.5" role="list">
          <li v-for="name in shownStations" :key="name" class="station-chip">
            <UBadge color="neutral" variant="outline" size="md">
              <span class="size-2 rounded-full" :style="{ background: step.color }" />
              {{ name }}
            </UBadge>
          </li>
        </ul>
      </div>
    </UCard>
  </Transition>
</template>

<script setup lang="ts">
  import type { StepInfo } from '@railtime/renderer/transitMap.types';
  import { computed } from 'vue';

  import { formatDay } from '~/utils/format.utils';

  const props = defineProps<{
    step: StepInfo | null;
    /** How many of the step's stations have appeared on the map so far. */
    revealed: number;
  }>();

  const shownStations = computed(() => props.step?.stations.slice(0, props.revealed) ?? []);
</script>

<style scoped>
  .step-card-enter-active,
  .step-card-leave-active {
    transition:
      opacity 0.35s,
      transform 0.35s;
  }
  .step-card-enter-from,
  .step-card-leave-to {
    opacity: 0;
    transform: translateY(6px);
  }
  .station-chip {
    animation: chip-in 0.3s ease-out;
  }
  @keyframes chip-in {
    from {
      opacity: 0;
      transform: scale(0.85);
    }
  }
</style>
