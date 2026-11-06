<template>
  <!-- A number that counts to each new value on the page's clock (`performance.now`, `requestAnimationFrame`), which a recorder moves a frame at a time, as it does the rest of a video. -->
  <ReelNumber :count :decimals :ungrouped />
</template>

<script setup lang="ts">
  import { computed, onBeforeUnmount, ref, watch } from 'vue';
  import { COUNT_MS } from '~/constants/count.constants';
  import type { Counting } from '~/utils/count.types';
  import { countOf, countedOnTo, restingOn } from '~/utils/count.utils';

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

  /** How it counts, once told a new value (`countedOnTo`); `null` until then, or for whoever asks for less motion: it stands on its value. */
  const counting = ref<Counting | null>(null);
  /** The page's clock, ms, as of the last frame. */
  const now = ref(0);
  const count = computed(() => {
    const { from, to, startedAt } = counting.value ?? restingOn(props.value);
    return countOf(from, to, now.value - startedAt);
  });

  /** The frame asked for, while it counts. */
  let frame: number | null = null;

  /**
   * A frame: the clock moved on, and another asked for until the number has landed.
   *
   * @param time - The page's clock, ms.
   */
  const tick = (time: number) => {
    now.value = time;
    frame = counting.value && time - counting.value.startedAt < COUNT_MS ? requestAnimationFrame(tick) : null;
  };

  watch(
    () => props.value,
    (value, previous) => {
      // Whoever asks for less motion gets the number, straight away. A recording rolls: the Chrome a
      // recorder drives reports no preference, whatever the machine's is set to.
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
        counting.value = null;
        return;
      }
      now.value = performance.now();
      counting.value = countedOnTo(counting.value ?? restingOn(previous), value, now.value);
      frame ??= requestAnimationFrame(tick);
    },
  );

  onBeforeUnmount(() => {
    if (frame !== null) cancelAnimationFrame(frame);
  });
</script>
