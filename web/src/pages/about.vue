<template>
  <TextPage title="About RailLineage" description="See how a city's rail network grew, on a real map, from its first line to today.">
    <TextSection title="What it is">
      <p class="text-muted">
        RailLineage shows the rail networks of {{ CITIES.length }} cities on a real map, in 2D or 3D. Pick any date to see a network as it stood that day, or
        press play and watch it grow, one change at a time. Some cities have never built a network: for those, you can explore what was planned.
      </p>
      <p class="text-muted">It is an independent project, and it isn't connected to any city or transit operator.</p>
    </TextSection>

    <TextSection title="What you can do">
      <dl class="flex flex-col gap-3">
        <div v-for="feature in ABOUT_FEATURES" :key="feature.name">
          <dt class="text-highlighted font-semibold">{{ feature.name }}</dt>
          <dd class="text-muted">{{ feature.text }}</dd>
        </div>
      </dl>
    </TextSection>

    <TextSection title="Maps and data">
      <p class="text-muted">
        Track, stations and map data © <TextLink to="https://www.openstreetmap.org/copyright">OpenStreetMap</TextLink> contributors, under the
        <TextLink to="https://opendatacommons.org/licenses/odbl/">Open Database License</TextLink>. Map tiles by
        <TextLink to="https://openfreemap.org">OpenFreeMap</TextLink>, in the <TextLink to="https://www.openmaptiles.org">OpenMapTiles</TextLink> format. Dates
        are checked against Wikipedia.
      </p>
    </TextSection>
  </TextPage>
</template>

<script setup lang="ts">
  import { CITIES } from '~/constants/city.constants';
  import { ABOUT_FEATURES } from '~/features/about/about.constants';
  import { usePageSeo } from '~/features/seo/pageSeo.composable';
  import { aboutSeo } from '~/features/seo/seo.utils';

  usePageSeo(aboutSeo());
</script>
