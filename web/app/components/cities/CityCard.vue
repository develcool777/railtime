<template>
  <NuxtLink :to="`/${city}`" class="city-card group" :class="{ 'lg:col-span-2': large }">
    <div class="border-default bg-muted flex items-center justify-center overflow-hidden border-b p-3" :class="large ? 'h-[150px] lg:h-[260px]' : 'h-[150px]'">
      <CityPreview v-if="network" :network :name class="h-full" />
      <USkeleton v-else class="h-full w-full" />
    </div>
    <div class="flex flex-col gap-1.5 px-[18px] pt-4 pb-[18px]">
      <div class="flex items-baseline justify-between gap-2">
        <h3 class="text-highlighted text-base font-bold">{{ name }}</h3>
        <span v-if="summary" class="text-muted flex-none text-[13px] tabular-nums">{{
          summary.planOnly ? 'Never built' : `${summary.openedYear} → today`
        }}</span>
      </div>
      <p v-if="summary" class="text-muted truncate text-[13px]">{{ summary.networks.join(' · ') }}</p>
      <p v-else-if="error" class="text-error text-[13px]">Could not load {{ name }}.</p>
      <p v-else class="text-muted text-[13px]">Loading…</p>
      <div v-if="summary" class="mt-1 flex flex-wrap items-center gap-1.5">
        <StatusChip v-if="summary.planOnly" tone="amber">Never built</StatusChip>
        <StatusChip v-else tone="green">History to play</StatusChip>
        <StatusChip v-if="summary.plans > 0" tone="blue">{{ summary.plans }} plan{{ summary.plans === 1 ? '' : 's' }}</StatusChip>
        <span class="text-muted text-[11px] tabular-nums">
          {{ summary.lines.length }} line{{ summary.lines.length === 1 ? '' : 's' }} · {{ summary.stations }} stations
        </span>
      </div>
    </div>
  </NuxtLink>
</template>

<script setup lang="ts">
  import { useFetch, useRuntimeConfig } from '#imports';
  import type { Network } from '@railtime/schema/network.types';
  import { computed } from 'vue';

  import StatusChip from '~/components/common/StatusChip.vue';
  import { cityNameOf, isLargeCity, networkUrlOf, summaryOf } from '~/utils/city.utils';

  import CityPreview from './CityPreview.vue';

  const props = defineProps<{ city: string }>();

  const name = computed(() => cityNameOf(props.city));
  // Fetched in the browser like the map's: the city page reuses it.
  const { data: network, error } = useFetch<Network>(networkUrlOf(props.city), { server: false, lazy: true, baseURL: useRuntimeConfig().app.baseURL });
  const summary = computed(() => (network.value ? summaryOf(network.value) : null));
  const large = computed(() => (summary.value ? isLargeCity(summary.value) : false));
</script>

<style scoped>
  .city-card {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border: 1px solid var(--ui-border);
    border-radius: 12px;
    background: var(--ui-bg);
    box-shadow: var(--rt-shadow-card);
    transition:
      border-color 0.15s,
      box-shadow 0.15s,
      transform 0.15s;
  }
  .city-card:hover {
    border-color: var(--ui-primary);
    box-shadow: var(--rt-shadow-card-hover);
    transform: translateY(-1px);
  }
</style>
