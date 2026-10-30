<template>
  <!-- The card leaving fades out over the one arriving. -->
  <div class="relative flex-none">
    <Transition name="step-card">
      <div v-if="step" :key="step.title + step.time" class="border-default bg-default shadow-card overflow-hidden rounded-xl border">
        <div class="h-1" :style="{ background: step.color }" />
        <div class="px-4 pt-3.5 pb-4">
          <p class="text-muted text-xs tabular-nums">{{ step.time === null ? 'Future' : formatDay(step.time) }}</p>
          <p class="text-highlighted mt-0.5 text-[17px] leading-snug font-bold">{{ step.title }}</p>
          <p v-if="step.subtitle" class="text-default text-sm">{{ step.subtitle }}</p>
          <ul v-if="shownStations.length" class="mt-2.5 flex flex-wrap gap-1.5" role="list">
            <li
              v-for="name in shownStations"
              :key="name"
              class="station-chip border-default bg-muted text-highlighted flex items-center gap-1.5 rounded border px-2 py-[3px] text-xs font-medium">
              <span class="size-[7px] rounded-full" :style="{ background: step.color }" />
              {{ name }}
            </li>
          </ul>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
  import type { StepInfo } from '@railtime/renderer/transitMap.types';
  import { computed } from 'vue';

  import { formatDay } from '~/features/explorer/format.utils';

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
  .step-card-leave-active {
    position: absolute;
    inset: 0 0 auto;
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
