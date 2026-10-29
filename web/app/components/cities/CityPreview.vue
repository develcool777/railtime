<template>
  <div ref="box" class="relative h-full w-full overflow-hidden">
    <!-- The basemap, once its picture is taken; the track is drawn over it from the start. -->
    <img v-if="image" :src="image" alt="" class="absolute inset-0 h-full w-full object-cover" @load="shown = true" />
    <div class="cover bg-muted absolute inset-0" :class="{ faded: shown }" />
    <svg
      v-if="preview && size"
      :viewBox="`0 0 ${size.width} ${size.height}`"
      preserveAspectRatio="xMidYMid slice"
      class="absolute inset-0 h-full w-full"
      fill="none"
      stroke-linecap="round"
      stroke-linejoin="round"
      role="img"
      :aria-label="`Map of the ${name} network`">
      <path
        v-for="(segment, index) in preview.paths"
        :key="index"
        :d="segment.path"
        :stroke="dark ? segment.darkColor : segment.color"
        stroke-width="2.5"
        :stroke-dasharray="planOnly ? '5 4' : undefined" />
    </svg>
  </div>
</template>

<script setup lang="ts">
  import type { Network } from '@railtime/schema/network.types';
  import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue';

  import { useBasemapStill } from '~/composables/basemapStill.composable';
  import type { PreviewSize } from '~/utils/city.types';
  import { isPlanOnly } from '~/utils/city.utils';
  import { previewOf } from '~/utils/preview.utils';

  const props = defineProps<{ network: Network; name: string }>();

  const box = useTemplateRef<HTMLElement>('box');
  const { take, theme } = useBasemapStill();
  const dark = computed(() => theme() === 'dark');
  // A network never built is drawn as its plan is on the map: dashed.
  const planOnly = computed(() => isPlanOnly(props.network));

  /** The preview's size when first laid out: its picture is taken at it, and scales with the card after. */
  const size = ref<PreviewSize | null>(null);
  const visible = ref(false);
  const image = ref<string | null>(null);
  /** The picture has loaded: the cover over it fades out. */
  const shown = ref(false);
  const preview = computed(() => (size.value ? previewOf(props.network, size.value) : null));

  let observer: IntersectionObserver | null = null;
  onMounted(() => {
    const element = box.value;
    if (!element) return;
    size.value = { width: Math.round(element.clientWidth), height: Math.round(element.clientHeight) };
    // Taken only once in view: the cards at the top first, the rest as they are scrolled to.
    observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) visible.value = true;
    });
    observer.observe(element);
  });
  onBeforeUnmount(() => observer?.disconnect());

  watch(
    [visible, preview, dark],
    async () => {
      if (!visible.value || !preview.value || !size.value) return;
      const wanted = { view: preview.value.view, ...size.value };
      const picture = await take(wanted).catch(() => null);
      // Only the latest asked for: a theme changed meanwhile asks again.
      if (wanted.view === preview.value?.view) image.value = picture;
    },
    { immediate: true },
  );
</script>

<style scoped>
  .cover {
    transition: opacity 0.4s;
  }
  .cover.faded {
    opacity: 0;
    pointer-events: none;
  }
</style>
