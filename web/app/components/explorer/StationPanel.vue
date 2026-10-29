<template>
  <UCard class="w-[min(320px,calc(100vw-32px))] bg-default/85 backdrop-blur" :ui="{ header: 'px-4 py-3 sm:px-4', body: 'px-4 py-3 sm:px-4 sm:py-3' }">
    <template #header>
      <div class="flex items-start justify-between gap-2">
        <div>
          <h2 class="text-highlighted text-lg leading-tight font-semibold">{{ station.name }}</h2>
          <p v-for="name in station.otherNames" :key="name" class="text-toned text-sm leading-tight">{{ name }}</p>
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
    <div v-if="station.transfers.length > 0" class="border-default mt-3 border-t pt-3">
      <p class="text-muted mb-1.5 text-xs">Change for</p>
      <ul class="space-y-1" role="list">
        <li v-for="transfer in station.transfers" :key="transfer.id">
          <button
            type="button"
            class="hover:bg-elevated -mx-1 flex w-full items-center gap-2 rounded px-1 py-0.5 text-left text-sm"
            @click="emit('select', transfer.id)">
            <span class="flex flex-none gap-0.5">
              <span v-for="line in transfer.lines" :key="line.id" class="h-1.5 w-3 rounded-full" :style="{ background: line.color }" :title="line.name" />
            </span>
            <span class="text-default flex-1">{{ transfer.name }}</span>
            <UIcon name="i-lucide-arrow-right" class="text-muted size-3.5" />
          </button>
        </li>
      </ul>
    </div>
  </UCard>
</template>

<script setup lang="ts">
  import type { StationInfo } from '@railtime/renderer/transitMap.types';

  import { formatFormerNames, formatSpan } from '~/utils/format.utils';

  defineProps<{ station: StationInfo }>();
  const emit = defineEmits<{ close: []; select: [station: string] }>();
</script>
