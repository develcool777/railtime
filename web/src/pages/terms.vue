<template>
  <TextPage title="Terms of use" :description="`Last updated ${LEGAL_UPDATED}.`">
    <TextSection title="Using the site">
      <p class="text-muted">
        RailLineage is free to use, for information and interest. It isn't connected to any city or transit operator, and their names are used only to describe
        their networks.
      </p>
    </TextSection>

    <TextSection title="What is estimated">
      <p class="text-muted">The dates and networks are curated by hand, so mistakes are possible. Some things are estimates by design:</p>
      <ul class="text-muted flex list-disc flex-col gap-2 pl-5">
        <li><strong class="text-highlighted font-semibold">Trains on the map</strong> are an illustration, not a timetable.</li>
        <li><strong class="text-highlighted font-semibold">Journey times</strong> are estimates. Check with the operator before you travel.</li>
        <li><strong class="text-highlighted font-semibold">Plans</strong> may not show a project's real route.</li>
      </ul>
    </TextSection>

    <TextSection title="No guarantee">
      <p class="text-muted">
        The site is provided as it is, with no guarantee that it is accurate, complete or always available. As far as the law allows, we aren't liable for any
        loss that comes from using it.
      </p>
    </TextSection>

    <TextSection title="Changes">
      <p class="text-muted">If these terms change, the new version appears here with a new date at the top.</p>
    </TextSection>
  </TextPage>
</template>

<script setup lang="ts">
  import { LEGAL_UPDATED } from '~/features/about/about.constants';
  import { usePageSeo } from '~/features/seo/pageSeo.composable';
  import { termsSeo } from '~/features/seo/seo.utils';

  usePageSeo(termsSeo());
</script>
