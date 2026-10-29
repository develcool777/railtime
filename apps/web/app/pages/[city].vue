<template>
  <div class="h-dvh w-full">
    <ClientOnly>
      <ExplorerView v-if="network" :key="city" :network :city @city="selectCity" />
      <div v-else class="text-muted grid h-full place-items-center text-sm">
        {{ error ? `Could not load the network: ${error.message}` : `Loading ${cityName}…` }}
      </div>
      <template #fallback>
        <div class="text-muted grid h-full place-items-center text-sm">Loading {{ cityName }}…</div>
      </template>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
  import { definePageMeta, navigateTo, useFetch, useHead, useRoute, useRuntimeConfig } from '#imports';
  import type { Network } from '@railtime/schema/network.types';
  import { computed } from 'vue';

  import ExplorerView from '~/components/explorer/ExplorerView.vue';
  import { cityNameOf, isCity, networkUrlOf } from '~/utils/city.utils';

  // Only cities with a dataset have a page: any other address is a 404.
  definePageMeta({ validate: route => isCity(route.params.city) });

  const route = useRoute();
  const city = computed(() => String(route.params.city));
  const cityName = computed(() => cityNameOf(city.value));
  useHead({ title: () => `Railtime · ${cityName.value}` });

  // The map only runs in the browser, so the network is fetched there too.
  const { data: network, error } = useFetch<Network>(() => networkUrlOf(city.value), { server: false, baseURL: useRuntimeConfig().app.baseURL });

  const selectCity = (next: string) => navigateTo(`/${next}`);
</script>
