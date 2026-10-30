<template>
  <div class="flex flex-col gap-5 px-4 pt-3 pb-6">
    <p v-if="station.otherNames.length > 0" class="text-default -mb-2 text-sm">{{ station.otherNames.join(' · ') }}</p>
    <div class="flex flex-wrap gap-2">
      <UButton
        icon="i-lucide-navigation"
        label="Route from here"
        color="neutral"
        variant="outline"
        size="sm"
        class="h-8 text-xs font-semibold"
        @click="emit('routeFrom')" />
      <UButton
        icon="i-lucide-flag"
        label="Route to here"
        color="neutral"
        variant="outline"
        size="sm"
        class="h-8 text-xs font-semibold"
        @click="emit('routeTo')" />
    </div>

    <section>
      <h3 class="eyebrow text-muted pb-1">Lines</h3>
      <ul role="list" class="-mx-2">
        <li v-for="line in station.lines" :key="line.id" :class="{ 'opacity-45': !isOpen(line) }">
          <button
            type="button"
            class="hover:bg-elevated flex h-9 w-full items-center gap-2.5 rounded-md px-2 text-left transition-colors duration-150"
            @click="emit('line', line.id)">
            <span class="h-1.5 w-[22px] flex-none rounded-full" :style="{ background: line.color }" />
            <span class="text-highlighted flex-1 truncate text-sm font-medium">{{ line.name }}</span>
            <span class="text-muted text-xs tabular-nums">{{ formatSpan(line.opened, line.closed) }}</span>
            <UIcon name="i-lucide-chevron-right" class="text-dimmed size-4 flex-none" />
          </button>
        </li>
      </ul>
    </section>

    <section v-if="next.length > 0">
      <h3 class="eyebrow text-muted pb-1.5">Next stations</h3>
      <StationLinks :stations="next" @select="emit('select', $event)" />
    </section>

    <section v-if="station.transfers.length > 0">
      <h3 class="eyebrow text-muted pb-1.5">Change for</h3>
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

  /** Whether a line served the station on the date shown. */
  const isOpen = (line: StationLineInfo): boolean => {
    if (props.date === null) return !line.closed;
    if (line.opened === null) return false;
    const day = new Date(props.date).toISOString().slice(0, 10);
    return line.opened <= day && (!line.closed || line.closed > day);
  };
</script>
