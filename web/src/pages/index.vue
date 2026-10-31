<template>
  <!-- At least the window's height, the list (UMain, but only as tall as the rest leaves) filling it: the footer stays at the foot with few cities shown. -->
  <div class="bg-page flex min-h-dvh flex-col">
    <SiteHeader />

    <UPageHero
      headline="Metro networks on the real map"
      title="A city's metro, on any day since it opened."
      description="See the network today, drag back to any date, or open a plan for what it could become. Then play it, one opening at a time."
      class="hero border-default border-b" />

    <UMain class="min-h-0 flex-1 pb-12">
      <UContainer class="pt-8">
        <CityFilterBar v-model:filter="filter" :shown="shownCount" :total="CITIES.length" />
      </UContainer>
      <!-- A country to a section, a line between each and the next. -->
      <UPageSection v-for="({ country, cities }, position) in sections" :key="country" :class="{ 'border-default border-t': position > 0 }">
        <template #title>
          <span class="flex items-center gap-2">
            {{ country }}
            <UBadge color="neutral" :label="`${cities.length} ${cities.length === 1 ? 'city' : 'cities'}`" />
          </span>
        </template>
        <UPageGrid>
          <CityCard v-for="city in cities" :key="city.value" :city="city.value" :summary="citySummaryOf(city.value)" :eager="EAGER_CITIES.has(city.value)" />
        </UPageGrid>
      </UPageSection>
      <UEmpty
        v-if="sections.length === 0"
        icon="i-lucide-search-x"
        title="No city matches"
        description="Try another name, or clear the filters."
        :actions="[{ label: 'Clear all', color: 'neutral', variant: 'outline', onClick: () => (filter = { ...NO_FILTER }) }]"
        size="md"
        class="py-16" />
    </UMain>

    <UFooter class="border-default border-t">
      <template #left>
        <MapCredits :credits="STILL_CREDITS" />
      </template>
    </UFooter>
  </div>
</template>

<script setup lang="ts">
  import { navigateTo, useRoute } from '#imports';
  import { STILL_CREDITS } from '@railtime/renderer/basemapStill.constants';
  import { computed, ref } from 'vue';

  import type { CityFilter } from '~/features/landing/cityFilter.types';
  import { NO_FILTER, matchesFilter } from '~/features/landing/cityFilter.utils';
  import { citiesByCountry, citySummaryOf, isCity } from '~/utils/city.utils';
  import { usePageSeo } from '~/features/seo/pageSeo.composable';
  import { CITIES } from '~/constants/city.constants';
  import { landingSeo } from '~/features/seo/seo.utils';

  usePageSeo(landingSeo(CITIES.length));

  // Links from before city pages (`/?city=tyne-and-wear`) still land on the city.
  const route = useRoute();
  if (isCity(route.query.city)) await navigateTo(`/${route.query.city}`, { replace: true });

  /** The first row's cards: their pictures load at once, the rest as they are scrolled to. */
  const EAGER_CITIES = new Set(CITIES.slice(0, 4).map(city => city.value));

  const filter = ref<CityFilter>({ ...NO_FILTER });

  /** Each country's cities that pass the filters; countries left with none are dropped. */
  const sections = computed(() =>
    citiesByCountry()
      .map(({ country, cities }) => ({
        country,
        cities: cities.filter(city => matchesFilter(city, citySummaryOf(city.value), filter.value)),
      }))
      .filter(section => section.cities.length > 0),
  );
  const shownCount = computed(() => sections.value.reduce((total, section) => total + section.cities.length, 0));
</script>

<style scoped>
  .hero {
    background: var(--rt-hero-bg);
  }
</style>
