<template>
  <!-- The city, its network and the years its history spans, over the map before anything is built. -->
  <div v-if="shown > 0" class="absolute inset-0 grid place-items-center bg-black/55" :style="{ opacity: shown }">
    <div class="flex flex-col items-center gap-[2vmin] text-center" :style="{ transform: `translateY(${(1 - shown) * 2}vmin)` }">
      <h1 class="text-[12vmin] leading-none font-extrabold tracking-tight">{{ name }}</h1>
      <p class="text-[3.6vmin] font-medium text-white/75">
        {{ networks.join(' · ') }}<template v-if="span"> · {{ span }}</template>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
  defineProps<{
    /** The city's name. */
    name: string;
    /** The brands its lines run under. */
    networks: string[];
    /** The years its history spans: "1960 – 2023". */
    span: string;
    /** How much of it shows, 0 to 1. */
    shown: number;
  }>();
</script>
