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

    <main class="mx-auto flex max-w-7xl flex-col gap-12 px-8 pt-10 pb-20 max-sm:px-4">
      <section v-for="{ country, cities } in COUNTRIES" :key="country">
        <h2 class="text-highlighted flex items-baseline gap-2 text-lg font-bold">
          {{ country }}
          <span class="text-muted text-[13px] font-normal">{{ cities.length }} {{ cities.length === 1 ? 'city' : 'cities' }}</span>
        </h2>
        <div class="mt-4 grid grid-flow-row-dense grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <CityCard v-for="city in cities" :key="city.value" :city="city.value" />
        </div>
      </section>
    </main>

    <footer class="border-default border-t">
      <MapCredits :credits="BasemapStill.credits" class="mx-auto max-w-7xl px-8 py-4 max-sm:px-4" />
    </footer>
  </div>
</template>

<script setup lang="ts">
  import { navigateTo, useHead, useRoute } from '#imports';

  import { BasemapStill } from '@railtime/renderer/basemapStill.service';

  import CityCard from '~/components/cities/CityCard.vue';
  import MapCredits from '~/components/explorer/MapCredits.vue';
  import { citiesByCountry, isCity } from '~/utils/city.utils';

  useHead({ title: 'Railtime' });

  const COUNTRIES = citiesByCountry();

  // Links from before city pages (`/?city=tyne-and-wear`) still land on the city.
  const route = useRoute();
  if (isCity(route.query.city)) await navigateTo(`/${route.query.city}`, { replace: true });
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
