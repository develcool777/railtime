<template>
  <!-- A row of a list that opens something: a ghost button the list's width, its content laid out by the list. -->
  <UButton color="neutral" variant="ghost" :active activeColor="primary" activeVariant="soft" class="w-full justify-start gap-2.5 px-2 text-left font-normal">
    <slot />
  </UButton>
</template>

<script setup lang="ts">
  defineProps<{
    /** The row picked: the change shown, the run drawn. */
    active?: boolean;
  }>();
</script>
