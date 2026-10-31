<template>
  <div class="flex flex-col gap-1.5">
    <UFieldGroup v-for="(group, position) in groups" :key="position" orientation="vertical" class="map-card overflow-hidden">
      <UTooltip v-for="tool in group" :key="tool.label" :text="tool.label" :kbds="tool.kbds" :content="{ side: 'left' }">
        <UButton
          :icon="tool.icon"
          color="neutral"
          variant="ghost"
          square
          class="border-muted size-10 justify-center rounded-none border-b last:border-b-0"
          :class="{ 'bg-selected text-selected': tool.active }"
          :ui="{ leadingIcon: 'size-[18px]' }"
          :aria-label="tool.label"
          :aria-pressed="tool.active"
          @click="tool.run" />
      </UTooltip>
    </UFieldGroup>
  </div>
</template>

<script setup lang="ts">
  import type { ViewMode } from '@railtime/renderer/transitMap.types';
  import { computed } from 'vue';

  const props = defineProps<{
    /** Whether the map names its stations. */
    stationNames: boolean;
    /** How the map is seen: flat, or in 3D. */
    viewMode: ViewMode;
  }>();
  const emit = defineEmits<{ zoomIn: []; zoomOut: []; fit: []; stationNames: [shown: boolean]; viewMode: [mode: ViewMode]; mapOnly: [] }>();

  const groups = computed(() => [
    [
      { label: 'Zoom in', icon: 'i-lucide-plus', kbds: undefined, active: undefined, run: () => emit('zoomIn') },
      { label: 'Zoom out', icon: 'i-lucide-minus', kbds: undefined, active: undefined, run: () => emit('zoomOut') },
      { label: 'Fit the network', icon: 'i-lucide-locate-fixed', kbds: undefined, active: undefined, run: () => emit('fit') },
    ],
    [
      {
        label: props.stationNames ? 'Hide station names' : 'Show station names',
        icon: 'i-lucide-type',
        kbds: ['N'],
        active: props.stationNames,
        run: () => emit('stationNames', !props.stationNames),
      },
      {
        label: props.viewMode === '3d' ? 'Flat map' : 'See in 3D',
        icon: 'i-lucide-box',
        kbds: undefined,
        active: props.viewMode === '3d',
        run: () => emit('viewMode', props.viewMode === '3d' ? '2d' : '3d'),
      },
      { label: 'Map only', icon: 'i-lucide-maximize-2', kbds: ['F'], active: undefined, run: () => emit('mapOnly') },
    ],
  ]);
</script>
