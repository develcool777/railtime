<template>
  <div class="bg-page flex min-h-dvh flex-col">
    <SiteHeader />

    <UMain class="min-h-0 flex-1 pb-12">
      <UContainer class="max-w-3xl">
        <UPageHeader
          title="About RailLineage"
          description="A city's metro on the real map, on any day since it opened: its history played one opening at a time, and the plans for what it could become." />

        <UPageBody>
          <section class="flex flex-col gap-3">
            <h2 class="text-highlighted text-xl font-bold">The map</h2>
            <p class="text-muted">
              The streets and buildings are
              <ULink to="https://openfreemap.org" target="_blank" class="text-primary hover:underline">OpenFreeMap</ULink>'s tiles, in the
              <ULink to="https://www.openmaptiles.org" target="_blank" class="text-primary hover:underline">OpenMapTiles</ULink> schema, from
              <ULink to="https://www.openstreetmap.org/copyright" target="_blank" class="text-primary hover:underline">OpenStreetMap</ULink> data (ODbL), drawn
              by <ULink to="https://maplibre.org" target="_blank" class="text-primary hover:underline">MapLibre GL JS</ULink>. The map credits them in its
              corner, as their licences ask.
            </p>
          </section>

          <section class="flex flex-col gap-3">
            <h2 class="text-highlighted text-xl font-bold">The networks</h2>
            <p class="text-muted">
              Each city's track and stations come from
              <ULink to="https://www.openstreetmap.org/copyright" target="_blank" class="text-primary hover:underline">OpenStreetMap</ULink>, under the
              <ULink to="https://opendatacommons.org/licenses/odbl/" target="_blank" class="text-primary hover:underline">Open Database License</ULink>.
              Opening, closing and renaming dates are checked against Wikipedia's articles on each line, station and railway company.
            </p>
          </section>

          <section class="flex flex-col gap-3">
            <h2 class="text-highlighted text-xl font-bold">Built with</h2>
            <p class="text-muted">
              <ULink to="https://nuxt.com" target="_blank" class="text-primary hover:underline">Nuxt</ULink> and
              <ULink to="https://ui.nuxt.com" target="_blank" class="text-primary hover:underline">Nuxt UI</ULink>, with
              <ULink to="https://maplibre.org" target="_blank" class="text-primary hover:underline">MapLibre GL JS</ULink> for the map.
            </p>
          </section>
        </UPageBody>
      </UContainer>
    </UMain>

    <SiteFooter />
  </div>
</template>

<script setup lang="ts">
  import { usePageSeo } from '~/features/seo/pageSeo.composable';
  import { aboutSeo } from '~/features/seo/seo.utils';

  usePageSeo(aboutSeo());
</script>
