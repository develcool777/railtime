<template>
  <div class="flex flex-col gap-4 px-4 pt-3 pb-6">
    <UFieldGroup size="xs" class="self-start">
      <UButton icon="i-lucide-navigation" label="Route from here" color="neutral" variant="subtle" @click="emit('routeFrom')" />
      <UButton icon="i-lucide-flag" label="To here" color="neutral" variant="subtle" @click="emit('routeTo')" />
    </UFieldGroup>

    <!-- Each line, with the stations either side of this one on it. -->
    <ul role="list" class="-mx-2 flex flex-col gap-1">
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
        <p v-if="neighboursOn(line.id).length > 0" class="text-muted flex flex-wrap items-center gap-x-1.5 pr-2 pl-[42px] text-xs leading-5">
          <template v-for="(next, place) in neighboursOn(line.id)" :key="next.id">
            <span v-if="place > 0" aria-hidden="true">·</span>
            <button type="button" class="hover:text-highlighted underline-offset-2 hover:underline" @click="emit('select', next.id)">{{ next.name }}</button>
          </template>
        </p>
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
  import type { NextStation } from '~/features/explorer/stations/station.types';

  const props = defineProps<{
    station: StationInfo;
    /** The stations one stop away, on its lines on the date shown. */
    next: NextStation[];
    /** The date shown, as a timestamp; `null` for a plan's future, when every line is open. */
    date: number | null;
  }>();
  const emit = defineEmits<{ select: [station: string]; line: [line: string]; routeFrom: []; routeTo: [] }>();

  /** The stations one stop away on a line. */
  const neighboursOn = (line: string): NextStation[] => props.next.filter(next => next.lines.some(entry => entry.id === line));

  /** Whether a line served the station on the date shown. */
  const isOpen = (line: StationLineInfo): boolean => {
    if (props.date === null) return !line.closed;
    if (line.opened === null) return false;
    const day = new Date(props.date).toISOString().slice(0, 10);
    return line.opened <= day && (!line.closed || line.closed > day);
  };
</script>
