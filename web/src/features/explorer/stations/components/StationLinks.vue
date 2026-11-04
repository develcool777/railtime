<template>
  <ul class="-mx-2 flex flex-col" role="list">
    <li v-for="station in stations" :key="station.id">
      <ListRow @click="emit('station', station.id)">
        <span class="flex flex-none gap-0.5">
          <span v-for="line in station.lines" :key="line.id" class="h-1.5 w-3 rounded-full" :style="{ background: lineColor(line.color) }" :title="line.name" />
        </span>
        <span class="text-highlighted flex-1 truncate text-sm font-medium">{{ station.name }}</span>
      </ListRow>
    </li>
  </ul>
</template>

<script setup lang="ts">
  import type { LineColor } from '@railtime/network/facts.types';
  import type { LineId, StationId } from '@railtime/schema/network.types';
  import { lineColor } from '~/utils/format.utils';

  defineProps<{
    /** Each station with the lines' colours to show beside it. */
    stations: { id: StationId; name: string; lines: { id: LineId; name: string; color: LineColor }[] }[];
  }>();
  const emit = defineEmits<{ station: [station: StationId] }>();
</script>
