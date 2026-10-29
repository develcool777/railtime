<template>
  <div class="flex flex-col gap-4 px-6 pt-3.5 pb-6 max-sm:px-4">
    <button type="button" class="text-muted hover:text-highlighted flex items-center gap-1.5 self-start text-[13px] font-medium" @click="emit('close')">
      <UIcon name="i-lucide-arrow-left" class="size-4" />
      {{ backLabel }}
    </button>
    <div>
      <h2 class="text-highlighted text-2xl leading-tight font-extrabold tracking-tight">{{ station.name }}</h2>
      <p v-for="name in station.otherNames" :key="name" class="text-default text-[15px]">{{ name }}</p>
      <p v-if="station.formerNames.length > 0" class="text-muted mt-1 text-[13px]">{{ formatFormerNames(station.formerNames) }}</p>
    </div>
    <section>
      <h3 class="eyebrow text-muted mb-2">Lines</h3>
      <ul class="flex flex-col gap-2" role="list">
        <li v-for="line in station.lines" :key="line.id" class="flex items-center gap-2.5" :class="{ 'opacity-50': !isOpen(line) }">
          <span class="h-1.5 w-[22px] flex-none rounded-full" :style="{ background: line.color }" />
          <span class="text-highlighted flex-1 text-sm font-medium">{{ line.name }}</span>
          <span class="text-muted text-[13px] tabular-nums">{{ formatSpan(line.opened, line.closed) }}</span>
        </li>
      </ul>
    </section>
    <section v-if="station.transfers.length > 0">
      <h3 class="eyebrow text-muted mb-2">Change for</h3>
      <ul class="flex flex-col gap-1.5" role="list">
        <li v-for="transfer in station.transfers" :key="transfer.id">
          <button
            type="button"
            class="border-default hover:border-primary flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors duration-150"
            @click="emit('select', transfer.id)">
            <span class="flex flex-none gap-0.5">
              <span v-for="line in transfer.lines" :key="line.id" class="h-1.5 w-3 rounded-full" :style="{ background: line.color }" :title="line.name" />
            </span>
            <span class="text-highlighted flex-1 text-sm font-medium">{{ transfer.name }}</span>
            <UIcon name="i-lucide-arrow-right" class="text-muted size-4" />
          </button>
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup lang="ts">
  import type { StationInfo, StationLineInfo } from '@railtime/renderer/transitMap.types';

  import { formatFormerNames, formatSpan } from '~/utils/format.utils';

  const props = defineProps<{
    station: StationInfo;
    /** Where the back link returns to: the tab the station was opened over. */
    backLabel: string;
    /** The date shown, as a timestamp; `null` for a plan's future, when every line is open. */
    date: number | null;
  }>();
  const emit = defineEmits<{ close: []; select: [station: string] }>();

  /** Whether a line served the station on the date shown. */
  const isOpen = (line: StationLineInfo): boolean => {
    if (props.date === null) return !line.closed;
    if (line.opened === null) return false;
    const day = new Date(props.date).toISOString().slice(0, 10);
    return line.opened <= day && (!line.closed || line.closed > day);
  };
</script>
