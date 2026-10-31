<template>
  <UPageCard :to="`/${city}`" :title="name" :description="summary.networks.join(' · ')" variant="outline" spotlight>
    <!-- The city's picture in each theme, drawn ahead by `pnpm data:previews`; the theme not shown is never loaded. -->
    <template #header>
      <UColorModeImage
        :light="previewUrlOf(city, 'light')"
        :dark="previewUrlOf(city, 'dark')"
        :alt="`Map of the ${name} network`"
        class="h-[170px] w-full object-cover"
        :width="PREVIEW_WIDTH"
        :height="PREVIEW_HEIGHT"
        :loading="eager ? 'eager' : 'lazy'"
        :fetchpriority="eager ? 'high' : 'auto'"
        decoding="async" />
    </template>
    <template #footer>
      <span class="flex flex-wrap items-center gap-1.5">
        <UBadge v-if="summary.planOnly" color="warning" label="Never built" />
        <UBadge v-else color="success" label="History to play" />
        <UBadge v-if="summary.plans > 0" color="info" :label="`${summary.plans} plan${summary.plans === 1 ? '' : 's'}`" />
        <span class="text-muted text-[11px] tabular-nums">
          <template v-if="!summary.planOnly">{{ summary.openedYear }} → today · </template>{{ summary.lines }} line{{ summary.lines === 1 ? '' : 's' }} ·
          {{ summary.stations }} stations
        </span>
      </span>
    </template>
  </UPageCard>
</template>

<script setup lang="ts">
  import type { CityIndexEntry } from '@railtime/schema/cityIndex.types';
  import { computed } from 'vue';

  import { cityNameOf, previewUrlOf } from '~/utils/city.utils';

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

  const name = computed(() => cityNameOf(props.city));
</script>
