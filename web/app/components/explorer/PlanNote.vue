<template>
  <div class="w-[min(360px,calc(100vw-32px))] space-y-2 p-3 text-xs">
    <p class="text-highlighted text-sm font-semibold">{{ plan.name }}</p>
    <p class="text-default">{{ plan.description }}</p>
    <div v-if="plan.sources?.length">
      <p class="text-muted mb-1">Sources</p>
      <ul class="space-y-0.5" role="list">
        <li v-for="source in plan.sources" :key="source" class="truncate">
          <ULink :to="source" target="_blank" class="text-muted hover:text-default underline">{{ sourceLabel(source) }}</ULink>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
  import type { Plan } from '@railtime/schema/network.types';

  import { sourceLabel } from '~/utils/format.utils';

  defineProps<{ plan: Plan }>();
</script>
