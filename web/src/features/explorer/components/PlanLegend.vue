<template>
  <div class="map-card text-default flex items-center gap-2 px-3 py-2 text-xs">
    <span class="h-0 w-[22px] flex-none border-t-[3px] border-dashed" :style="{ borderColor: color }" />
    <span
      ><b class="text-highlighted">{{ name }}</b> · dashed track is not built</span
    >
  </div>
</template>

<script setup lang="ts">
  defineProps<{
    /** The plan shown. */
    name: string;
    /** Its first line's colour. */
    color: string;
  }>();
</script>
