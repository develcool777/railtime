<template>
  <div class="flex flex-col gap-4 px-4 pt-3 pb-6">
    <!-- Each line, with the stops either side of this one on it. -->
    <ul role="list" class="-mx-2 flex flex-col gap-2">
      <li v-for="line in station.lines" :key="line.id" :class="{ 'opacity-45': !isOpen(line) }">
        <button
          type="button"
          class="hover:bg-elevated flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-left transition-colors duration-150"
          @click="emit('line', line.id)">
          <span class="h-1.5 w-[22px] flex-none rounded-full" :style="{ background: line.color }" />
          <span class="text-highlighted flex-1 truncate text-sm font-medium">{{ line.name }}</span>
          <span class="text-muted text-xs tabular-nums">{{ formatSpan(line.opened, line.closed) }}</span>
          <UIcon name="i-lucide-chevron-right" class="text-dimmed size-4 flex-none" />
        </button>
        <!-- The stops either side, as a platform's sign gives them: back to the left, on to the right. -->
        <div v-for="(direction, place) in directions.get(line.id) ?? []" :key="place" class="grid grid-cols-2 gap-1 pr-1 pb-1 pl-[38px]">
          <button
            v-if="direction.previous"
            type="button"
            class="hover:bg-elevated min-w-0 rounded-md px-1.5 py-1 text-left transition-colors duration-150"
            @click="emit('select', direction.previous.id)">
            <span class="text-highlighted flex items-center gap-1 text-[13px] font-medium">
              <UIcon name="i-lucide-chevron-left" class="text-muted size-3.5 flex-none" />
              <span class="truncate">{{ direction.previous.name }}</span>
            </span>
            <span v-if="direction.previous.towards" class="text-muted block pl-[18px] text-[11px] leading-tight">towards {{ direction.previous.towards }}</span>
          </button>
          <span v-else class="text-dimmed self-center px-1.5 text-[11px]">end of the line</span>
          <button
            v-if="direction.next"
            type="button"
            class="hover:bg-elevated min-w-0 rounded-md px-1.5 py-1 text-right transition-colors duration-150"
            @click="emit('select', direction.next.id)">
            <span class="text-highlighted flex items-center justify-end gap-1 text-[13px] font-medium">
              <span class="truncate">{{ direction.next.name }}</span>
              <UIcon name="i-lucide-chevron-right" class="text-muted size-3.5 flex-none" />
            </span>
            <span v-if="direction.next.towards" class="text-muted block pr-[18px] text-[11px] leading-tight">towards {{ direction.next.towards }}</span>
          </button>
          <span v-else class="text-dimmed self-center px-1.5 text-right text-[11px]">end of the line</span>
        </div>
      </li>
    </ul>

    <section v-if="station.transfers.length > 0">
      <h3 class="eyebrow text-muted pb-1">Change for</h3>
      <StationLinks :stations="station.transfers" @select="emit('select', $event)" />
    </section>

    <section v-if="station.formerNames.length > 0">
      <h3 class="eyebrow text-muted pb-1">Former names</h3>
      <p v-for="former in station.formerNames" :key="former.until" class="text-default py-1 text-sm">
        {{ [former.name, ...former.otherNames].join(' / ') }} <span class="text-muted text-xs">until {{ former.until.slice(0, 4) }}</span>
      </p>
    </section>
  </div>
</template>

<script setup lang="ts">
  import type { StationInfo, StationLineInfo } from '@railtime/renderer/transitMap.types';

  import { formatSpan } from '~/features/explorer/format.utils';
  import type { LineDirection } from '~/features/explorer/stations/station.types';

  const props = defineProps<{
    station: StationInfo;
    /** The stops either side of it on each of its lines, on the date shown, by line. */
    directions: Map<string, LineDirection[]>;
    /** The date shown, as a timestamp; `null` for a plan's future, when every line is open. */
    date: number | null;
  }>();
  const emit = defineEmits<{ select: [station: string]; line: [line: string] }>();

  /** Whether a line served the station on the date shown. */
  const isOpen = (line: StationLineInfo): boolean => {
    if (props.date === null) return !line.closed;
    if (line.opened === null) return false;
    const day = new Date(props.date).toISOString().slice(0, 10);
    return line.opened <= day && (!line.closed || line.closed > day);
  };
</script>
