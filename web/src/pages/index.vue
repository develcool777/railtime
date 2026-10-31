<template>
  <!-- At least the window's height, the list (UMain, but only as tall as the rest leaves) filling it: the footer stays at the foot with few cities shown. -->
  <div class="bg-page flex min-h-dvh flex-col">
    <SiteHeader />

    <UPageHero
      headline="Metro networks on the real map"
      title="A city's metro, on any day since it opened."
      description="See the network today, drag back to any date, or open a plan for what it could become. Then play it, one opening at a time."
      class="hero border-default border-b" />

    <!-- Search and filters, kept in reach while scrolling; on a phone they would cover half the screen, so they scroll away. -->
    <div class="border-default bg-page/95 z-[9] border-b backdrop-blur-sm sm:sticky sm:top-(--ui-header-height)">
      <UContainer class="flex flex-wrap items-center gap-2.5 py-3">
        <UInput
          v-model="filter.query"
          icon="i-lucide-search"
          placeholder="Search cities or networks"
          size="lg"
          class="min-w-[220px] flex-1"
          aria-label="Search cities" />
        <USelect v-model="countryChoice" :items="COUNTRY_ITEMS" size="lg" class="w-48 max-sm:flex-1" aria-label="Country" />
        <UTabs v-model="filter.kind" :items="KIND_ITEMS" :content="false" size="md" aria-label="Kind of city" />
        <UButton
          :icon="filter.withPlans ? 'i-lucide-check' : 'i-lucide-route'"
          label="With plans"
          :color="filter.withPlans ? 'primary' : 'neutral'"
          :variant="filter.withPlans ? 'soft' : 'outline'"
          size="lg"
          :aria-pressed="filter.withPlans"
          @click="filter.withPlans = !filter.withPlans" />
        <span class="text-muted ml-auto text-[13px] tabular-nums">{{ shownCount }} of {{ CITIES.length }} cities</span>
      </UContainer>
    </div>

    <UMain class="min-h-0 flex-1 pb-12">
      <UPageSection
        v-for="{ country, cities } in sections"
        :key="country"
        :title="country"
        :description="`${cities.length} ${cities.length === 1 ? 'city' : 'cities'}`">
        <UPageGrid>
          <CityCard v-for="city in cities" :key="city.value" :city="city.value" :summary="summaryOf(city.value)" :eager="EAGER_CITIES.has(city.value)" />
        </UPageGrid>
      </UPageSection>
      <UEmpty
        v-if="sections.length === 0"
        icon="i-lucide-search-x"
        title="No city matches"
        description="Try another name, or clear the filters."
        :actions="[{ label: 'Clear filters', color: 'neutral', variant: 'outline', onClick: clearFilters }]"
        variant="naked"
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
  import CITY_INDEX from '@railtime/data/cities.json';
  import { STILL_CREDITS } from '@railtime/renderer/basemapStill.constants';
  import type { CityIndex, CityIndexEntry } from '@railtime/schema/cityIndex.types';
  import { computed, reactive } from 'vue';

  import type { CityFilter } from '~/features/landing/cityFilter.types';
  import { matchesFilter } from '~/features/landing/cityFilter.utils';
  import { citiesByCountry, isCity } from '~/utils/city.utils';
  import { usePageSeo } from '~/features/seo/pageSeo.composable';
  import { CITIES } from '~/constants/city.constants';
  import { landingSeo } from '~/features/seo/seo.utils';

  usePageSeo(landingSeo(CITIES.length));

  // Links from before city pages (`/?city=tyne-and-wear`) still land on the city.
  const route = useRoute();
  if (isCity(route.query.city)) await navigateTo(`/${route.query.city}`, { replace: true });

  /** Every country, as the select offers it, before the countries themselves. */
  const ALL_COUNTRIES = 'all';
  const COUNTRY_ITEMS = [{ label: 'All countries', value: ALL_COUNTRIES }, ...citiesByCountry().map(({ country }) => ({ label: country, value: country }))];
  const KIND_ITEMS: { label: string; value: CityFilter['kind'] }[] = [
    { label: 'All', value: 'all' },
    { label: 'History', value: 'history' },
    { label: 'Never built', value: 'never-built' },
  ];

  // What every card shows, built into the page: it is prerendered whole, its pictures already drawn.
  const INDEX: CityIndex = CITY_INDEX;
  const summaryOf = (city: string): CityIndexEntry => {
    const entry = INDEX[city];
    // A test keeps the index and the menu's cities the same.
    if (!entry) throw new Error(`${city} is not in cities.json`);
    return entry;
  };
  /** The first row's cards: their pictures load at once, the rest as they are scrolled to. */
  const EAGER_CITIES = new Set(CITIES.slice(0, 4).map(city => city.value));

  const filter = reactive<CityFilter>({ query: '', country: '', kind: 'all', withPlans: false });
  const countryChoice = computed({
    get: () => filter.country || ALL_COUNTRIES,
    set: (value: string) => (filter.country = value === ALL_COUNTRIES ? '' : value),
  });

  /** Each country's cities that pass the filters; countries left with none are dropped. */
  const sections = computed(() =>
    citiesByCountry()
      .map(({ country, cities }) => ({
        country,
        cities: cities.filter(city => matchesFilter(city, summaryOf(city.value), filter)),
      }))
      .filter(section => section.cities.length > 0),
  );
  const shownCount = computed(() => sections.value.reduce((total, section) => total + section.cities.length, 0));

  const clearFilters = () => Object.assign(filter, { query: '', country: '', kind: 'all', withPlans: false });
</script>

<style scoped>
  .hero {
    background: var(--rt-hero-bg);
  }
</style>
