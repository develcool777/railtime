<template>
  <div class="flex flex-col gap-5 px-4 pt-3 pb-6">
    <p v-if="line.branches.length === 0" class="text-muted text-sm">Not open on the date shown.</p>
    <section v-for="(run, position) in line.branches" :key="position">
      <h3 class="eyebrow text-muted pb-1">{{ position === 0 ? 'Stations' : `Branch from ${run[0]?.name}` }}</h3>
      <!-- A line diagram: the line down the side, a stop at each station. -->
      <ol class="relative -mx-2" role="list">
        <span class="absolute top-4 bottom-4 left-[17px] w-1 rounded-full" :style="{ background: line.color }" />
        <li v-for="(stop, place) in run" :key="`${stop.id}-${place}`" :class="{ 'opacity-60': position > 0 && place === 0 }">
          <button
            type="button"
            class="hover:bg-elevated relative flex h-8 w-full items-center gap-3 rounded-md px-2 text-left transition-colors duration-150"
            @click="emit('station', stop.id)">
            <span class="flex w-5 flex-none justify-center">
              <span v-if="otherLines(stop.id).length > 0" class="bg-default size-3 rounded-full border-2 border-(--ui-text-highlighted)" />
              <span v-else class="bg-default size-2.5 rounded-full border-2" :style="{ borderColor: line.color }" />
            </span>
            <span class="text-highlighted flex-1 truncate text-sm" :class="otherLines(stop.id).length > 0 ? 'font-semibold' : 'font-medium'">{{
              stop.name
            }}</span>
            <span class="flex flex-none gap-0.5">
              <span v-for="color in otherLines(stop.id)" :key="color" class="h-1 w-2.5 rounded-full" :style="{ background: color }" />
            </span>
          </button>
        </li>
      </ol>
    </section>

    <section v-if="changes.length > 0">
      <h3 class="eyebrow text-muted pb-1">Changes</h3>
      <ul role="list" class="-mx-2">
        <li v-for="change in changes" :key="change.index">
          <ChangeRow :change @select="emit('change', $event)" />
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup lang="ts">
  import type { ChangeInfo, LineDetails } from '@railtime/renderer/transitMap.types';

  const props = defineProps<{
    line: LineDetails;
    /** The changes that made the line. */
    changes: ChangeInfo[];
    /** Each station on the map's lines' colours, to mark the interchanges. */
    stationColors: Map<string, string[]>;
  }>();
  const emit = defineEmits<{ station: [station: string]; change: [index: number] }>();

  /** The other lines' colours at a stop: none for a stop on this line alone. */
  const otherLines = (station: string): string[] => (props.stationColors.get(station) ?? []).filter(color => color !== props.line.color);
</script>
