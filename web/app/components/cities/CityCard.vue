<template>
  <UPageCard :to="`/${city}`" :title="name" :description spotlight :ui="{ header: 'w-full' }">
    <!-- The sketch goes in the header: filling `body` would drop the title and description. -->
    <template #header>
      <div class="bg-elevated/50 overflow-hidden rounded-lg border border-default">
        <CityPreview v-if="network" :network :name />
        <USkeleton v-else class="aspect-16/9 w-full rounded-none" />
      </div>
    </template>
    <template #footer>
      <div v-if="summary" class="flex w-full flex-wrap items-center justify-between gap-2">
        <span class="text-muted text-sm tabular-nums"
          >{{ summary.lines.length }} line{{ summary.lines.length === 1 ? '' : 's' }} · {{ summary.stations }} stations</span
        >
        <span class="flex flex-wrap gap-1" aria-hidden="true">
          <span v-for="line in summary.lines" :key="line.id" class="h-1.5 w-4 rounded-full" :style="{ background: dark ? line.darkColor : line.color }" />
        </span>
      </div>
      <p v-else-if="error" class="text-error text-sm">Could not load {{ name }}.</p>
    </template>
  </UPageCard>
</template>

<script setup lang="ts">
  import { useColorMode, useFetch, useRuntimeConfig } from '#imports';
  import type { Network } from '@railtime/schema/network.types';
  import { computed } from 'vue';

  import { cityNameOf, networkUrlOf, summaryOf } from '~/utils/city.utils';

  import CityPreview from './CityPreview.vue';

  const props = defineProps<{ city: string }>();

  const name = computed(() => cityNameOf(props.city));
  // Fetched in the browser like the map's: the city page reuses it.
  const { data: network, error } = useFetch<Network>(networkUrlOf(props.city), { server: false, lazy: true, baseURL: useRuntimeConfig().app.baseURL });
  const summary = computed(() => (network.value ? summaryOf(network.value) : null));
  const description = computed(() => {
    if (!summary.value) return 'Loading…';
    const since = summary.value.openedYear ? `${summary.value.openedYear} to today` : '';
    return [summary.value.networks.join(' and '), since].filter(Boolean).join(' · ');
  });

  const colorMode = useColorMode();
  const dark = computed(() => colorMode.value === 'dark');
</script>
