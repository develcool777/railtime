<template>
  <!-- As the investors site's filter toolbar: the search and the country on top, a pill per filter below, the count and "Clear all" at the end. -->
  <div class="border-default bg-default shadow-card flex flex-col gap-3 rounded-lg border px-5 py-4">
    <div class="flex items-stretch gap-3 max-md:flex-col">
      <UInput v-model="filter.query" icon="i-lucide-search" placeholder="Search cities or networks" class="flex-1" aria-label="Search cities" />
      <USelect v-model="countryChoice" :items="countryItems" class="w-48 shrink-0 max-md:w-full" aria-label="Country" />
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <UButton
        v-for="pill in pills"
        :key="pill.label"
        :label="pill.label"
        :icon="pill.icon"
        :color="pill.on ? 'primary' : 'neutral'"
        variant="soft"
        size="sm"
        class="rounded-full"
        :aria-pressed="pill.on"
        @click="pill.toggle" />

      <div class="ml-auto flex items-center gap-2">
        <span class="text-muted text-[13px] tabular-nums"
          >{{ isFiltering(filter) ? `${shown} of ${total}` : total }} {{ total === 1 ? 'city' : 'cities' }}</span
        >
        <UButton v-if="isFiltering(filter)" label="Clear all" variant="link" size="sm" class="px-0" @click="filter = { ...NO_FILTER }" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue';

  import type { CityFilter } from '~/features/landing/cityFilter.types';
  import { NO_FILTER, isFiltering } from '~/features/landing/cityFilter.utils';
  import { citiesByCountry } from '~/utils/city.utils';

  defineProps<{
    /** How many cities the filters leave. */
    shown: number;
    /** How many cities there are. */
    total: number;
  }>();
  const filter = defineModel<CityFilter>('filter', { required: true });

  /** Every country, as the select offers it, before the countries themselves. */
  const ALL_COUNTRIES = 'all';
  const countryItems = [{ label: 'All countries', value: ALL_COUNTRIES }, ...citiesByCountry().map(({ country }) => ({ label: country, value: country }))];
  const countryChoice = computed({
    get: () => filter.value.country || ALL_COUNTRIES,
    set: (value: string) => (filter.value = { ...filter.value, country: value === ALL_COUNTRIES ? '' : value }),
  });

  /** Picks a kind of city, or lets it go when it is picked already: history and never built rule each other out. */
  const toggleKind = (kind: Exclude<CityFilter['kind'], 'all'>) => (filter.value = { ...filter.value, kind: filter.value.kind === kind ? 'all' : kind });

  const pills = computed(() => [
    { label: 'History to play', icon: 'i-lucide-history', on: filter.value.kind === 'history', toggle: () => toggleKind('history') },
    { label: 'Never built', icon: 'i-lucide-drafting-compass', on: filter.value.kind === 'never-built', toggle: () => toggleKind('never-built') },
    {
      label: 'With plans',
      icon: 'i-lucide-route',
      on: filter.value.withPlans,
      toggle: () => (filter.value = { ...filter.value, withPlans: !filter.value.withPlans }),
    },
  ]);
</script>
