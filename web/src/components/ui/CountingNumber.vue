<template>
  <!-- A number that counts to each new value on the browser's clock. A video's numbers go by its page's clock instead, for a recorder to step: `ReelNumber` alone. -->
  <ReelNumber :count :decimals :ungrouped />
</template>

<script setup lang="ts">
  import { computed, onBeforeUnmount, ref, watch } from 'vue';
  import { COUNT_MS, SETTLE_MS } from '~/constants/count.constants';
  import { countOf } from '~/utils/count.utils';

  const props = withDefaults(
    defineProps<{
      /** The number. */
      value: number;
      /** How many of its last digits follow a point. */
      decimals?: number;
      /** Leaves its thousands unparted, as a year's are. */
      ungrouped?: boolean;
    }>(),
    { decimals: 0 },
  );

  /** The whole number it comes to. */
  const target = computed(() => Math.round(props.value));
  /** What it counts from and when it started, by the browser's clock, ms; `null` at rest. */
  const counting = ref<{ from: number; startedAt: number } | null>(null);
  /** The browser's clock, ms, as of the last frame. */
  const now = ref(0);
  const count = computed(() =>
    counting.value ? countOf(counting.value.from, target.value, now.value - counting.value.startedAt) : { now: target.value, before: target.value },
  );

  /** The frame asked for, while it counts. */
  let frame: number | null = null;

  /**
   * A frame: the clock moved on, and another asked for until the number has settled.
   *
   * @param time - The browser's clock, ms.
   */
  const tick = (time: number) => {
    now.value = time;
    if (counting.value && time - counting.value.startedAt < COUNT_MS + SETTLE_MS) {
      frame = requestAnimationFrame(tick);
      return;
    }
    counting.value = null;
    frame = null;
  };

  watch(target, (_next, previous) => {
    // Whoever asks for less motion gets the number, straight away.
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    now.value = performance.now();
    counting.value = { from: counting.value ? count.value.now : previous, startedAt: now.value };
    frame ??= requestAnimationFrame(tick);
  });

  onBeforeUnmount(() => {
    if (frame !== null) cancelAnimationFrame(frame);
  });
</script>
