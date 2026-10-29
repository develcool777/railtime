<template>
  <UContainer class="py-10 sm:py-16">
    <header class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-highlighted text-4xl font-bold tracking-tight sm:text-5xl">Railtime</h1>
        <p class="text-muted mt-3 max-w-xl text-base sm:text-lg">
          Rail networks on the real map: explore them as they are today, or play their history from the first line, one opening at a time.
        </p>
      </div>
      <UColorModeButton class="flex-none" />
    </header>
    <section v-for="{ country, cities } in COUNTRIES" :key="country" class="mt-10">
      <h2 class="text-highlighted text-xl font-semibold">{{ country }}</h2>
      <UPageGrid class="mt-4 lg:grid-cols-2">
        <CityCard v-for="city in cities" :key="city.value" :city="city.value" />
      </UPageGrid>
    </section>
  </UContainer>
</template>

<script setup lang="ts">
  import { navigateTo, useHead, useRoute } from '#imports';

  import CityCard from '~/components/cities/CityCard.vue';
  import { citiesByCountry, isCity } from '~/utils/city.utils';

  useHead({ title: 'Railtime' });

  const COUNTRIES = citiesByCountry();

  // Links from before city pages (`/?city=tyne-and-wear`) still land on the city.
  const route = useRoute();
  if (isCity(route.query.city)) await navigateTo(`/${route.query.city}`, { replace: true });
</script>
