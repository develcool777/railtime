<template>
  <!-- A city's history as a video, to record (pnpm video:record); only under pnpm dev: the site built leaves it out (nuxt.config.ts). -->
  <ClientOnly>
    <VideoView v-if="network" :network :city />
    <div v-else class="grid h-dvh place-items-center bg-black text-sm text-white/60">
      {{ error ? `Could not load the network: ${error.message}` : 'Loading…' }}
    </div>
  </ClientOnly>
</template>

<script setup lang="ts">
  import { definePageMeta, useHead, useRoute } from '#imports';
  import { computed } from 'vue';

  import { useCityNetwork } from '~/utils/city.composable';
  import { isCity } from '~/utils/city.utils';

  // Only cities with a dataset have a video; a video is always dark.
  definePageMeta({ validate: route => isCity(route.params.city), colorMode: 'dark' });

  // Nothing but the video in the frame: the dev tools' button too would be recorded.
  useHead({ style: [{ innerHTML: '#nuxt-devtools-container { display: none !important; }' }] });

  const city = computed(() => String(useRoute().params.city));
  const { network, error } = useCityNetwork(city);
</script>
