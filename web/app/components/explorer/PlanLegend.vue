<template>
  <div class="border-default bg-default text-default shadow-soft flex items-center gap-4 rounded-lg border px-3 py-2 text-xs">
    <span v-if="built" class="flex items-center gap-1.5">
      <span class="bg-inverted h-[3px] w-5 rounded-full" />
      Built
    </span>
    <span class="flex items-center gap-1.5">
      <span class="border-inverted h-0 w-5 border-t-[3px] border-dashed" />
      Planned
    </span>
    <span class="flex items-center gap-1.5">
      <span class="border-inverted size-[9px] rounded-full border-2" />
      Unbuilt station
    </span>
  </div>
</template>

<script setup lang="ts">
  defineProps<{
    /** Whether anything was built: a network never built has only planned track. */
    built: boolean;
  }>();
</script>
