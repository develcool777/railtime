<template>
  <svg
    :viewBox="`0 0 ${PREVIEW_WIDTH} ${PREVIEW_HEIGHT}`"
    class="h-auto w-full"
    fill="none"
    stroke-linecap="round"
    stroke-linejoin="round"
    role="img"
    :aria-label="`Sketch of the ${name} network`">
    <path v-for="(segment, index) in paths" :key="index" :d="segment.path" :stroke="dark ? segment.darkColor : segment.color" stroke-width="1.6" />
  </svg>
</template>

<script setup lang="ts">
  import { useColorMode } from '#imports';
  import type { Network } from '@railtime/schema/network.types';
  import { computed } from 'vue';

  import { PREVIEW_HEIGHT, PREVIEW_WIDTH, previewPathsOf } from '~/utils/preview.utils';

  const props = defineProps<{ network: Network; name: string }>();

  const colorMode = useColorMode();
  const dark = computed(() => colorMode.value === 'dark');
  const paths = computed(() => previewPathsOf(props.network));
</script>
