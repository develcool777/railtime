<template>
  <UApp>
    <div class="bg-page flex min-h-dvh flex-col">
      <SiteHeader />
      <UMain class="min-h-0 flex-1">
        <UError :error="shown" :clear="{ label: 'All cities' }" redirect="/" />
      </UMain>
    </div>
  </UApp>
</template>

<script setup lang="ts">
  import type { NuxtError } from '#app';
  import { computed } from 'vue';

  const props = defineProps<{ error: NuxtError }>();

  // An address with no page (a city without a dataset, a mistyped link) says so plainly; any other
  // error says what it is.
  const shown = computed(() =>
    props.error.statusCode === 404
      ? { statusCode: 404, statusMessage: 'No such page', message: 'There is no map at this address. Pick a city from the list.' }
      : props.error,
  );
</script>
