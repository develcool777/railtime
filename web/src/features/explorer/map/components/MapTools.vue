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
          :ui="{ leadingIcon: 'size-[18px]' }"
          :aria-label="tool.label"
          :aria-pressed="tool.pressed"
          @click="tool.run">
          <!-- How the map is seen, written as map apps write it: no icon says 2D. -->
          <span v-if="tool.text" class="text-[13px] font-bold tracking-tight">{{ tool.text }}</span>
        </UButton>
      </UTooltip>
    </UFieldGroup>
  </div>
</template>

<script setup lang="ts">
  import type { ViewMode } from '@railtime/renderer/transitMap.types';
  import { computed } from 'vue';

  import type { MapTool } from '~/features/explorer/map/map.types';

  const props = defineProps<{
    /** Whether the map names its stations. */
    stationNames: boolean;
    /** How the map is seen: flat, or in 3D. */
    viewMode: ViewMode;
  }>();
  const emit = defineEmits<{ zoomIn: []; zoomOut: []; fit: []; stationNames: [shown: boolean]; viewMode: [mode: ViewMode]; mapOnly: []; help: [] }>();

  const groups = computed((): MapTool[][] => [
    [
      { label: 'Zoom in', icon: 'i-lucide-plus', run: () => emit('zoomIn') },
      { label: 'Zoom out', icon: 'i-lucide-minus', run: () => emit('zoomOut') },
      { label: 'Fit the network', icon: 'i-lucide-locate-fixed', run: () => emit('fit') },
    ],
    [
      {
        label: props.stationNames ? 'Hide station names' : 'Show station names',
        // The icon says how the map is: names on it, or none.
        icon: props.stationNames ? 'i-lucide-captions' : 'i-lucide-captions-off',
        kbds: ['N'],
        pressed: props.stationNames,
        run: () => emit('stationNames', !props.stationNames),
      },
      {
        label: props.viewMode === '3d' ? 'Flat map' : 'See in 3D',
        // It says how the map is seen: flat, or in 3D.
        text: props.viewMode === '3d' ? '3D' : '2D',
        kbds: ['D'],
        pressed: props.viewMode === '3d',
        run: () => emit('viewMode', props.viewMode === '3d' ? '2d' : '3d'),
      },
      { label: 'Map only', icon: 'i-lucide-maximize-2', kbds: ['F'], run: () => emit('mapOnly') },
      { label: 'What you can do', icon: 'i-lucide-circle-help', kbds: ['?'], run: () => emit('help') },
    ],
  ]);
</script>
