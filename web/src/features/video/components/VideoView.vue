<template>
  <!-- A video's frame: the map edge to edge, and over it the scene shown, each piece as much as `layers` says. -->
  <div class="relative h-dvh w-full overflow-hidden bg-[#0b0d10] text-white">
    <!-- MapLibre makes the map's own element relative: it fills a frame of its own. -->
    <div class="absolute inset-0"><div ref="container" class="h-full w-full" /></div>
    <VideoTitle :name="cityName" :networks="summary.networks" :span="store.span" :shown="store.layers.title" />
    <VideoYear v-if="store.time" :time="store.time" :shown="store.layers.year" />
    <VideoCaption v-if="store.caption" :step="store.caption" :shown="store.layers.caption" />
    <VideoEnd :name="cityName" :stats="store.time?.stats ?? null" :address :shown="store.layers.end" />
    <MapCredits :credits="store.credits" class="absolute right-[2vmin] bottom-[1.2vmin] opacity-70" />
  </div>
</template>

<script setup lang="ts">
  import { useRuntimeConfig } from '#imports';
  import type { Network } from '@railtime/schema/network.types';
  import { ref } from 'vue';

  import { cityNameOf, citySummaryOf } from '~/utils/city.utils';
  import { useVideoMap } from '~/features/video/video.composable';
  import { useVideoStore } from '~/features/video/video.store';
  import { spokenAddress } from '~/features/video/video.utils';

  const props = defineProps<{
    /** The city's network. */
    network: Network;
    /** The city, by its id. */
    city: string;
  }>();

  const store = useVideoStore();
  const container = ref<HTMLElement | null>(null);
  useVideoMap(container, props.network);

  const cityName = cityNameOf(props.city);
  const summary = citySummaryOf(props.city);
  const address = spokenAddress(useRuntimeConfig().public.publishedUrl);
</script>
