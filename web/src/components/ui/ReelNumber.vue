<template>
  <!-- A number on reels, as a title's counter in After Effects: each digit turning in its own window, blurred by how far it moved as the shutter was open. Read out as the number it comes to, never its reels. -->
  <span class="inline-flex items-baseline tabular-nums" role="img" :aria-label="spoken">
    <template v-for="part in parts" :key="part.key">
      <span v-if="part.mark !== null" class="overflow-hidden" :style="{ width: `${part.width * MARK_WIDTH_EM}em` }">{{ part.mark }}</span>
      <span
        v-else
        class="block overflow-hidden [mask-image:linear-gradient(transparent,black_10%,black_90%,transparent)]"
        :style="{ width: `${part.width}ch`, height: `${REEL_HEIGHT_EM}em`, lineHeight: `${REEL_HEIGHT_EM}em` }">
        <svg v-if="part.blur > 0" class="absolute size-0" aria-hidden="true">
          <filter :id="`${id}${part.key}`" x="0" y="-0.5" width="1" height="2" primitiveUnits="objectBoundingBox" color-interpolation-filters="sRGB">
            <feGaussianBlur :stdDeviation="`0 ${part.blur}`" />
          </filter>
        </svg>
        <span
          class="relative block"
          :style="{
            height: `${REEL_HEIGHT_EM * 2}em`,
            transform: `translateY(${-part.offset * REEL_HEIGHT_EM}em)`,
            filter: part.blur > 0 ? `url(#${id}${part.key})` : undefined,
          }">
          <span class="block">{{ part.digit }}</span>
          <!-- Laid out where the digit is and moved down: a row of its own would round to its own pixel, and a digit landing would snap. -->
          <span class="absolute inset-x-0 top-0" :style="{ transform: `translateY(${REEL_HEIGHT_EM}em)` }">{{ part.next }}</span>
        </span>
      </span>
    </template>
  </span>
</template>

<script setup lang="ts">
  import { computed, useId } from 'vue';
  import { MARK_WIDTH_EM, REEL_HEIGHT_EM } from '~/constants/count.constants';
  import type { Count } from '~/utils/count.types';
  import { reelsOf } from '~/utils/count.utils';

  const props = withDefaults(
    defineProps<{
      /** The number, as it counts. */
      count: Count;
      /** How many of its last digits follow a point. */
      decimals?: number;
      /** Leaves its thousands unparted, as a year's are. */
      ungrouped?: boolean;
    }>(),
    { decimals: 0 },
  );

  const id = useId();
  const spoken = computed(() => (Math.round(props.count.now) / 10 ** props.decimals).toLocaleString('en-GB'));
  const parts = computed(() => reelsOf(props.count, { decimals: props.decimals, grouped: !props.ungrouped }));
</script>
