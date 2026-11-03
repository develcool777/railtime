<template>
  <div class="h-dvh w-full">
    <ClientOnly>
      <ExplorerView v-if="network" :key="city" :network :city :plan @city="selectCity" @plan="selectPlan" />
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
  import { definePageMeta, navigateTo, useRoute, useRuntimeConfig } from '#imports';
  import { NetworkFacts } from '@railtime/network/facts.service';
  import { computed } from 'vue';

  import { usePageSeo } from '~/features/seo/pageSeo.composable';
  import { useCityNetwork } from '~/utils/city.composable';
  import { cityNameOf, citySummaryOf, isCity, previewUrlOf } from '~/utils/city.utils';
  import { citySeo } from '~/features/seo/seo.utils';

  // Only cities with a dataset have a page: any other address is a 404. Each city is a page of its
  // own, mounted afresh (its title and description with it); a plan in the address changes neither.
  definePageMeta({ validate: route => isCity(route.params.city), key: route => String(route.params.city) });

  const route = useRoute();
  const city = computed(() => String(route.params.city));
  const cityName = computed(() => cityNameOf(city.value));
  const baseURL = useRuntimeConfig().app.baseURL;
  const entry = citySummaryOf(city.value);
  const seo = citySeo(city.value, entry);
  usePageSeo(seo);

  const { network, error } = useCityNetwork(city);

  // A plan is shown in place, on the same map: the explorer is keyed on the city alone.
  // A network never built always shows a plan: its first, unless the address names another.
  const plan = computed(() => (network.value ? NetworkFacts.planToOpen(network.value, route.query.plan) : undefined));

  const selectCity = (next: string) => navigateTo(`/${next}`);
  // A plan is chosen on Plans: it goes in the address, Plans staying open.
  const selectPlan = (next: string | undefined) => {
    const query = Object.fromEntries(Object.entries(route.query).filter(([key]) => key !== 'plan' && key !== 'tab'));
    return navigateTo({ query: { ...query, ...(next ? { plan: next } : {}), tab: 'plans' }, replace: true });
  };
</script>
