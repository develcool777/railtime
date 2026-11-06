<template>
  <!-- One panel round the map: in from its edge, what it measures and its headline above its chart, revealed left to right. Always laid out, so its column never moves as it comes. -->
  <section
    class="flex min-h-0 flex-col rounded-[1.4vmin] bg-[#0b0d10]/92 p-[2vmin] ring-1 ring-white/10"
    :style="{ opacity: motion.shown, transform: `translateX(${offset}vmin)` }">
    <p class="text-[1.8vmin] font-semibold tracking-[0.14em] text-white/60 uppercase">{{ title }}</p>
    <p class="mt-[0.4vmin] mb-[1.2vmin] text-[4vmin] leading-none font-extrabold tracking-tight"><slot name="headline" /></p>
    <div class="flex min-h-0 flex-1 flex-col" :style="{ clipPath: `inset(0 ${(1 - motion.drawn) * 100}% 0 0)` }">
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import { PANEL_SLIDE_VMIN } from '~/features/video/insights/insights.constants';
  import type { PanelMotion } from '~/features/video/insights/insights.types';

  const props = defineProps<{
    /** The edge it comes in from. */
    side: 'left' | 'right';
    /** What it measures. */
    title: string;
    /** How far it has come. */
    motion: PanelMotion;
  }>();

  defineSlots<{
    /** What it comes to. */
    headline: () => unknown;
    /** The chart. */
    default: () => unknown;
  }>();

  const offset = computed(() => (1 - props.motion.shown) * PANEL_SLIDE_VMIN * (props.side === 'left' ? -1 : 1));
</script>
