<template>
  <UCard class="w-[min(320px,calc(100vw-32px))] bg-default/85 backdrop-blur" :ui="{ header: 'px-4 py-3 sm:px-4', body: 'px-4 py-3 sm:px-4 sm:py-3' }">
    <template #header>
      <div class="flex items-start justify-between gap-2">
        <div>
          <h2 class="text-highlighted text-lg leading-tight font-semibold">{{ station.name }}</h2>
          <p v-if="station.formerNames.length > 0" class="text-muted mt-0.5 text-xs">{{ formatFormerNames(station.formerNames) }}</p>
        </div>
        <UButton icon="i-lucide-x" color="neutral" variant="ghost" size="xs" aria-label="Close" @click="emit('close')" />
      </div>
    </template>
    <ul class="space-y-1.5" role="list">
      <li v-for="line in station.lines" :key="line.id" class="flex items-center gap-2 text-sm" :class="{ 'opacity-60': line.closed }">
        <span class="h-1.5 w-5 flex-none rounded-full" :style="{ background: line.color }" />
        <span class="text-default flex-1">{{ line.name }}</span>
        <span class="text-muted text-xs tabular-nums">{{ formatSpan(line.opened, line.closed) }}</span>
      </li>
    </ul>
  </UCard>
</template>

<script setup lang="ts">
  import type { StationInfo } from '@railtime/renderer/transitMap.types';

  import { formatFormerNames, formatSpan } from '~/utils/format.utils';

  defineProps<{ station: StationInfo }>();
  const emit = defineEmits<{ close: [] }>();
</script>
