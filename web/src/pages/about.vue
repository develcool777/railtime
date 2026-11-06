<template>
  <div class="bg-page flex min-h-dvh flex-col">
    <SiteHeader />

    <UMain class="min-h-0 flex-1 pb-12">
      <UContainer class="max-w-3xl">
        <UPageHeader title="About RailLineage" description="See how a city's rail network grew, on a real map, from its first line to today." />

        <UPageBody>
          <section class="flex flex-col gap-3">
            <h2 class="text-highlighted text-xl font-bold">What it is</h2>
            <p class="text-muted">
              RailLineage shows the rail networks of {{ CITIES.length }} cities on a real map, in 2D or 3D. Pick any date to see a network as it stood that day,
              or press play and watch it grow, one change at a time. Some cities have never built a network: for those, you can explore what was planned.
            </p>
            <p class="text-muted">It is an independent project, and it isn't connected to any city or transit operator.</p>
          </section>

          <section class="flex flex-col gap-3">
            <h2 class="text-highlighted text-xl font-bold">What you can do</h2>
            <dl class="flex flex-col gap-3">
              <div v-for="feature in ABOUT_FEATURES" :key="feature.name">
                <dt class="text-highlighted font-semibold">{{ feature.name }}</dt>
                <dd class="text-muted">{{ feature.text }}</dd>
              </div>
            </dl>
          </section>

          <section class="flex flex-col gap-3">
            <h2 class="text-highlighted text-xl font-bold">Where the data comes from</h2>
            <ul class="text-muted flex list-disc flex-col gap-2 pl-5">
              <li>
                <ULink to="https://www.openstreetmap.org/copyright" target="_blank" class="text-primary hover:underline">OpenStreetMap</ULink>: each city's
                track, stations and outline, and the background map's data, © OpenStreetMap contributors, under the
                <ULink to="https://opendatacommons.org/licenses/odbl/" target="_blank" class="text-primary hover:underline">Open Database License</ULink>.
              </li>
              <li><ULink to="https://openfreemap.org" target="_blank" class="text-primary hover:underline">OpenFreeMap</ULink>: the background map's tiles.</li>
              <li>
                <ULink to="https://www.openmaptiles.org" target="_blank" class="text-primary hover:underline">OpenMapTiles</ULink>: the format of those tiles.
              </li>
            </ul>
            <p class="text-muted">Opening, closing and renaming dates are checked against Wikipedia's articles on each line, station and railway company.</p>
          </section>

          <section class="flex flex-col gap-3">
            <h2 class="text-highlighted text-xl font-bold">What is estimated</h2>
            <p class="text-muted">The dates and networks are curated by hand, so mistakes are possible. Some things on the site are estimates by design:</p>
            <ul class="text-muted flex list-disc flex-col gap-2 pl-5">
              <li>
                <strong class="text-highlighted font-semibold">Trains on the map</strong> are an illustration. There is no timetable behind them: they run by
                the rules real lines follow, using published figures where they exist and fitted ones where they don't.
              </li>
              <li>
                <strong class="text-highlighted font-semibold">Journey times</strong> use the same rules, so they are estimates. Check with the operator before
                you travel.
              </li>
              <li>
                <strong class="text-highlighted font-semibold">Plans</strong> may not show a project's real route. Where its track isn't recorded, the map
                curves it through its stations, so treat it as a sketch.
              </li>
            </ul>
          </section>
        </UPageBody>
      </UContainer>
    </UMain>

    <SiteFooter />
  </div>
</template>

<script setup lang="ts">
  import { CITIES } from '~/constants/city.constants';
  import { ABOUT_FEATURES } from '~/features/about/about.constants';
  import { usePageSeo } from '~/features/seo/pageSeo.composable';
  import { aboutSeo } from '~/features/seo/seo.utils';

  usePageSeo(aboutSeo());
</script>
