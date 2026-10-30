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
          <UIcon name="i-lucide-chevron-right" class="text-dimmed size-4 flex-none" />
        </button>
        <!-- A piece of the line, drawn as the line's view draws it: the stop before, this station, the stop after. The line sits over the rows' hover, under the dots. -->
        <ol v-for="(direction, place) in directions.get(line.id) ?? []" :key="place" class="relative mt-0.5 mb-1 ml-[30px]" role="list">
          <span class="absolute top-3.5 bottom-3.5 left-[9px] w-1 rounded-full" :style="{ background: line.color }" />
          <li v-for="row in stripAround(direction, station)" :key="row.id">
            <span v-if="row.here" class="flex h-7 items-center gap-2.5 px-0.5" aria-current="location">
              <span class="flex w-4 flex-none justify-center">
                <span
                  class="relative size-3.5 rounded-full border-[3px] border-(--ui-bg)"
                  :style="{ background: line.color, boxShadow: `0 0 0 2px ${line.color}` }" />
              </span>
              <span class="text-highlighted min-w-0 flex-1 truncate text-[13px] font-bold">{{ row.name }}</span>
              <span class="text-dimmed flex-none pr-2 text-[11px]">{{ row.note }}</span>
            </span>
            <button
              v-else
              type="button"
              class="hover:bg-elevated flex h-7 w-full items-center gap-2.5 rounded-md px-0.5 text-left transition-colors duration-150"
              @click="emit('select', row.id)">
              <span class="flex w-4 flex-none justify-center">
                <span class="bg-default relative size-2.5 rounded-full border-2" :style="{ borderColor: line.color }" />
              </span>
              <span class="text-default min-w-0 flex-1 truncate text-[13px] font-medium">{{ row.name }}</span>
              <span class="text-muted max-w-[50%] flex-none truncate pr-2 text-[11px]">{{ row.note }}</span>
            </button>
          </li>
        </ol>
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

  import type { LineDirection } from '~/features/explorer/stations/station.types';
  import { stripAround } from '~/features/explorer/stations/station.utils';

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
