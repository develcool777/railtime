<template>
  <div class="flex flex-col gap-4 px-6 pt-3.5 pb-6 max-sm:px-4">
    <button type="button" class="text-muted hover:text-highlighted flex items-center gap-1.5 self-start text-[13px] font-medium" @click="emit('close')">
      <UIcon name="i-lucide-arrow-left" class="size-4" />
      {{ backLabel }}
    </button>

    <div>
      <div class="flex items-center gap-2.5">
        <span class="h-2 w-[26px] flex-none rounded-full" :style="{ background: line.color }" />
        <h2 class="text-highlighted text-2xl leading-tight font-extrabold tracking-tight">{{ line.name }}</h2>
      </div>
      <p class="text-muted mt-1 text-[13px]">{{ line.networkName }} · {{ line.opened === null ? 'planned' : `opened ${formatDay(line.opened)}` }}</p>
      <div v-if="line.branches.length > 0" class="mt-3 flex gap-6">
        <div>
          <p class="text-highlighted text-xl font-bold tabular-nums">{{ line.stations }}</p>
          <p class="text-muted text-xs">stations</p>
        </div>
        <div>
          <p class="text-highlighted text-xl font-bold tabular-nums">{{ Math.round(line.km) }}</p>
          <p class="text-muted text-xs">km</p>
        </div>
        <div v-if="line.branches.length > 1">
          <p class="text-highlighted text-xl font-bold tabular-nums">{{ line.branches.length - 1 }}</p>
          <p class="text-muted text-xs">{{ line.branches.length === 2 ? 'branch' : 'branches' }}</p>
        </div>
      </div>
      <p v-else class="text-muted mt-3 text-sm">Not open on the date shown.</p>
    </div>

    <section v-for="(run, position) in line.branches" :key="position">
      <h3 class="eyebrow text-muted mb-2">{{ position === 0 ? 'Stations' : `Branch from ${run[0]?.name}` }}</h3>
      <!-- A line diagram: the line down the side, a stop at each station. -->
      <ol class="relative" role="list">
        <span class="absolute top-3 bottom-3 left-[7px] w-1 rounded-full" :style="{ background: line.color }" />
        <li v-for="(stop, place) in run" :key="`${stop.id}-${place}`" :class="{ 'opacity-60': position > 0 && place === 0 }">
          <button
            type="button"
            class="hover:bg-elevated relative flex w-full items-center gap-3 rounded-md py-1 pr-2 text-left transition-colors duration-150"
            @click="emit('station', stop.id)">
            <span class="bg-default size-[18px] flex-none rounded-full border-[3px]" :style="{ borderColor: line.color }" />
            <span class="text-highlighted text-sm font-medium">{{ stop.name }}</span>
          </button>
        </li>
      </ol>
    </section>

    <section v-if="changes.length > 0">
      <h3 class="eyebrow text-muted mb-1">History</h3>
      <ul role="list" class="-mx-2">
        <li v-for="change in changes" :key="change.index">
          <ChangeRow :change :upcoming="time !== null && change.index >= time.cursor" @select="emit('change', $event)" />
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup lang="ts">
  import type { ChangeInfo, LineDetails, TimeState } from '@railtime/renderer/transitMap.types';

  import { formatDay } from '~/utils/format.utils';

  import ChangeRow from './ChangeRow.vue';

  defineProps<{
    line: LineDetails;
    /** The changes that made the line. */
    changes: ChangeInfo[];
    time: TimeState | null;
    /** Where the back link returns to: the tab the line was opened from. */
    backLabel: string;
  }>();
  const emit = defineEmits<{ close: []; station: [station: string]; change: [index: number] }>();
</script>
