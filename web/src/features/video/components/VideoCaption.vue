<template>
  <!-- The change playing: its line's colour beside what happened and where; rising in as it shows. -->
  <div
    v-if="shown > 0"
    class="absolute bottom-[6vmin] left-[5vmin] flex max-w-[70vw] items-stretch gap-[2vmin] rounded-[2vmin] bg-black/65 px-[3vmin] py-[2.2vmin] backdrop-blur-sm"
    :style="{ opacity: shown, transform: `translateY(${(1 - shown) * 3}vmin)` }">
    <span class="w-[1vmin] flex-none rounded-full" :style="{ background: lineColor(step.color) }" />
    <div class="flex min-w-0 flex-col gap-[0.6vmin]">
      <p class="truncate text-[4.4vmin] leading-tight font-bold">{{ step.title }}</p>
      <p v-if="step.subtitle" class="truncate text-[3vmin] text-white/75">{{ step.subtitle }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
  import type { StepInfo } from '@railtime/network/facts.types';

  import { lineColor } from '~/utils/format.utils';

  defineProps<{
    /** The change. */
    step: StepInfo;
    /** How much of it shows, 0 to 1. */
    shown: number;
  }>();
</script>
