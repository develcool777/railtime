<template>
  <div class="bg-page flex min-h-dvh flex-col">
    <SiteHeader />

    <UMain class="min-h-0 flex-1 pb-12">
      <UContainer class="max-w-3xl">
        <UPageHeader :title :description />
        <UPageBody>
          <slot />
        </UPageBody>
      </UContainer>
    </UMain>

    <SiteFooter />
  </div>
</template>

<script setup lang="ts">
  defineProps<{
    /** What the page is called. */
    title: string;
    /** What it says under its title. */
    description: string;
  }>();

  defineSlots<{
    /** Its sections. */
    default: () => unknown;
  }>();
</script>
