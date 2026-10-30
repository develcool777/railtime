<template>
  <NuxtLink :to="`/${city}`" class="city-card group">
    <!-- The city's picture in each theme, drawn ahead by `pnpm data:previews`; the theme not shown is never loaded. -->
    <div class="border-default bg-muted h-[170px] overflow-hidden border-b">
      <img
        v-for="theme in THEMES"
        :key="theme"
        :src="`${baseURL}${previewUrlOf(city, theme)}`"
        :alt="`Map of the ${name} network`"
        class="h-full w-full object-cover"
        :class="theme === 'dark' ? 'hidden dark:block' : 'dark:hidden'"
        :width="PREVIEW_WIDTH"
        :height="PREVIEW_HEIGHT"
        :loading="eager ? 'eager' : 'lazy'"
        :fetchpriority="eager ? 'high' : 'auto'"
        decoding="async" />
    </div>
    <div class="flex flex-1 flex-col gap-1.5 px-[18px] pt-4 pb-[18px]">
      <div class="flex items-baseline justify-between gap-2">
        <h3 class="text-highlighted text-base font-bold">{{ name }}</h3>
        <span class="text-muted flex-none text-[13px] tabular-nums">{{ summary.planOnly ? 'Never built' : `${summary.openedYear} → today` }}</span>
      </div>
      <p class="text-muted truncate text-[13px]">{{ summary.networks.join(' · ') }}</p>
      <div class="mt-1 flex flex-wrap items-center gap-1.5">
        <StatusChip v-if="summary.planOnly" tone="amber">Never built</StatusChip>
        <StatusChip v-else tone="green">History to play</StatusChip>
        <StatusChip v-if="summary.plans > 0" tone="blue">{{ summary.plans }} plan{{ summary.plans === 1 ? '' : 's' }}</StatusChip>
        <span class="text-muted text-[11px] tabular-nums">
          {{ summary.lines }} line{{ summary.lines === 1 ? '' : 's' }} · {{ summary.stations }} stations
        </span>
      </div>
    </div>
  </NuxtLink>
</template>

<script setup lang="ts">
  import { useRuntimeConfig } from '#imports';
  import type { CityIndexEntry } from '@railtime/schema/cityIndex.types';
  import { computed } from 'vue';

  import { cityNameOf, previewUrlOf } from '~/utils/city.utils';

  /** The themes a preview is drawn in. */
  const THEMES = ['dark', 'light'] as const;
  /** A preview's size, as it was drawn: the box it fills crops it. */
  const PREVIEW_WIDTH = 400;
  const PREVIEW_HEIGHT = 170;

  const props = defineProps<{
    city: string;
    /** Its entry in the index of cities. */
    summary: CityIndexEntry;
    /** Among the first cards on the page: its picture loads at once, not when scrolled to. */
    eager?: boolean;
  }>();

  const baseURL = useRuntimeConfig().app.baseURL;
  const name = computed(() => cityNameOf(props.city));
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
