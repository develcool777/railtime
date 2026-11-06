<template>
  <!-- All the room its panel leaves, measured: `UChart` takes pixels, never a share. The size is read as this mounts, so the chart is there before the panel shows, and follows the frame's after. -->
  <div ref="room" class="min-h-0 flex-1">
    <slot v-if="height > 0" :height="Math.round(height)" />
  </div>
</template>

<script setup lang="ts">
  import { useElementSize } from '@vueuse/core';
  import { useTemplateRef } from 'vue';

  defineSlots<{
    /** The chart, at the height it is given, pixels. */
    default: (props: { height: number }) => unknown;
  }>();

  const room = useTemplateRef<HTMLElement>('room');
  const { height } = useElementSize(room);
</script>
