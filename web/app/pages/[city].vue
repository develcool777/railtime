<template>
  <div class="h-dvh w-full">
    <ClientOnly>
      <ExplorerView v-if="network" :key="`${city}|${plan ?? ''}`" :network :city :plan @city="selectCity" @plan="selectPlan" />
      <div v-else class="text-muted grid h-full place-items-center text-sm">
        {{ error ? `Could not load the network: ${error.message}` : `Loading ${cityName}…` }}
      </div>
      <!-- What the page is before the map runs: prerendered, so search engines and links read it. -->
      <template #fallback>
        <div class="grid h-full place-items-center p-6">
          <div class="flex max-w-xl flex-col items-center gap-4 text-center">
            <h1 class="text-highlighted text-2xl font-extrabold tracking-tight">{{ cityName }} metro</h1>
            <img
              :src="`${baseURL}${previewUrlOf(city, 'dark')}`"
              :alt="`Map of the ${cityName} network`"
              width="400"
              height="170"
              class="border-default w-full rounded-xl border" />
            <p class="text-muted text-sm">{{ seo.description }}</p>
            <p class="text-muted text-xs">Loading the map…</p>
          </div>
        </div>
      </template>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
  import { definePageMeta, navigateTo, useFetch, useRoute, useRuntimeConfig } from '#imports';
  import CITY_INDEX from '@railtime/data/cities.json';
  import type { CityIndex } from '@railtime/schema/cityIndex.types';
  import type { Network } from '@railtime/schema/network.types';
  import { computed } from 'vue';

  import ExplorerView from '~/components/explorer/ExplorerView.vue';
  import { usePageSeo } from '~/composables/pageSeo.composable';
  import { cityNameOf, isCity, networkUrlOf, planToOpen, previewUrlOf } from '~/utils/city.utils';
  import { citySeo } from '~/utils/seo.utils';

  // Only cities with a dataset have a page: any other address is a 404. Each city is a page of its
  // own, mounted afresh (its title and description with it); a plan in the address changes neither.
  definePageMeta({ validate: route => isCity(route.params.city), key: route => String(route.params.city) });

  const route = useRoute();
  const city = computed(() => String(route.params.city));
  const cityName = computed(() => cityNameOf(city.value));
  const baseURL = useRuntimeConfig().app.baseURL;
  const INDEX: CityIndex = CITY_INDEX;
  const entry = INDEX[city.value];
  if (!entry) throw new Error(`${city.value} is not in cities.json`);
  const seo = citySeo(city.value, entry);
  usePageSeo(seo);

  // The map only runs in the browser, so the network is fetched there too.
  const { data: network, error } = useFetch<Network>(() => networkUrlOf(city.value), { server: false, baseURL });

  // A plan rebuilds the map: the page keys the explorer on it, so a new one mounts where the old one looked.
  // A network never built always shows a plan: its first, unless the address names another.
  const plan = computed(() => (network.value ? planToOpen(network.value, route.query.plan) : undefined));

  const selectCity = (next: string) => navigateTo(`/${next}`);
  const selectPlan = (next: string | undefined) => {
    const query = Object.fromEntries(Object.entries(route.query).filter(([key]) => key !== 'plan'));
    return navigateTo({ query: next ? { ...query, plan: next } : query, replace: true });
  };
</script>
