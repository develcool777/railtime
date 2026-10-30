<template>
  <div class="bg-page min-h-full">
    <header class="border-default bg-default sticky top-0 z-10 border-b">
      <div class="mx-auto flex max-w-7xl items-center justify-between px-8 py-3.5 max-sm:px-4">
        <NuxtLink to="/" class="flex items-center gap-2.5" aria-label="Railtime">
          <span class="flex gap-[3px]" aria-hidden="true">
            <span class="bg-brand-500 h-[18px] w-1.5 rounded-sm" />
            <span class="bg-brand-300 h-[18px] w-1.5 rounded-sm" />
          </span>
          <span class="text-highlighted text-lg font-extrabold tracking-tight">railtime</span>
        </NuxtLink>
        <UColorModeButton color="neutral" variant="outline" />
      </div>
    </header>

    <section class="hero border-default border-b">
      <div class="mx-auto max-w-7xl px-8 pt-16 pb-14 max-sm:px-4 max-sm:pt-10 max-sm:pb-9">
        <p class="eyebrow text-primary">Metro networks on the real map</p>
        <h1 class="hero-title text-highlighted mt-3 max-w-[720px] font-extrabold">A city's metro, on any day since it opened.</h1>
        <p class="text-default mt-4 max-w-[600px] text-[17px] leading-relaxed">
          See the network today, drag back to any date, or open a plan for what it could become. Then play it, one opening at a time.
        </p>
      </div>
    </section>

    <!-- Search and filters, kept in reach while scrolling; on a phone they would cover half the screen, so they scroll away. -->
    <div class="border-default bg-page/95 z-[9] border-b backdrop-blur-sm sm:sticky sm:top-[63px]">
      <div class="mx-auto flex max-w-7xl flex-wrap items-center gap-2.5 px-8 py-3 max-sm:px-4">
        <UInput
          v-model="filter.query"
          icon="i-lucide-search"
          placeholder="Search cities or networks"
          size="lg"
          class="min-w-[220px] flex-1"
          aria-label="Search cities" />
        <USelect v-model="countryChoice" :items="COUNTRY_ITEMS" size="lg" class="w-48 max-sm:flex-1" aria-label="Country" />
        <SegmentedControl v-model="filter.kind" :items="KIND_ITEMS" label="Kind of city" />
        <UButton
          :icon="filter.withPlans ? 'i-lucide-check' : 'i-lucide-route'"
          label="With plans"
          :color="filter.withPlans ? 'primary' : 'neutral'"
          :variant="filter.withPlans ? 'soft' : 'outline'"
          size="lg"
          :aria-pressed="filter.withPlans"
          @click="filter.withPlans = !filter.withPlans" />
        <span class="text-muted ml-auto text-[13px] tabular-nums">{{ shownCount }} of {{ CITIES.length }} cities</span>
      </div>
    </div>

    <main class="mx-auto flex max-w-7xl flex-col gap-12 px-8 pt-10 pb-20 max-sm:px-4">
      <section v-for="{ country, cities } in sections" :key="country">
        <h2 class="text-highlighted flex items-baseline gap-2 text-lg font-bold">
          {{ country }}
          <span class="text-muted text-[13px] font-normal">{{ cities.length }} {{ cities.length === 1 ? 'city' : 'cities' }}</span>
        </h2>
        <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <CityCard v-for="city in cities" :key="city.value" :city="city.value" :summary="summaryOf(city.value)" :eager="EAGER_CITIES.has(city.value)" />
        </div>
      </section>
      <div v-if="sections.length === 0" class="flex flex-col items-center gap-3 py-16 text-center">
        <p class="text-muted text-sm">No city matches.</p>
        <UButton label="Clear filters" color="neutral" variant="outline" @click="clearFilters" />
      </div>
    </main>

    <footer class="border-default border-t">
      <MapCredits :credits="STILL_CREDITS" class="mx-auto max-w-7xl px-8 py-4 max-sm:px-4" />
    </footer>
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
  .hero-title {
    font-size: clamp(1.75rem, 5vw, 3.5rem);
    letter-spacing: -0.02em;
    line-height: 1.05;
  }
</style>
