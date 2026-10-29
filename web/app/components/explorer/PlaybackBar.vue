<template>
  <div class="flex items-center gap-2 rounded-xl border border-default bg-default/85 px-3 py-2 shadow-lg backdrop-blur">
    <UButton
      :icon="playing ? 'i-lucide-pause' : 'i-lucide-play'"
      :aria-label="playing ? 'Pause' : 'Play'"
      class="flex-none"
      @click="playing ? emit('pause') : emit('play')" />
    <UTooltip text="Next change">
      <UButton icon="i-lucide-skip-forward" color="neutral" variant="outline" aria-label="Next change" class="flex-none" @click="emit('skip')" />
    </UTooltip>
    <USlider class="min-w-0 flex-1" :min="range.start" :max="range.end" :step="DAY_MS" :modelValue="time" aria-label="Timeline" @update:modelValue="onSlide" />
    <USelect :modelValue="speed" :items="SPEED_OPTIONS" class="w-20 flex-none" aria-label="Speed" @update:modelValue="emit('speed', Number($event))" />
    <USelect
      :modelValue="camera"
      :items="CAMERA_OPTIONS"
      class="hidden w-28 flex-none sm:flex"
      aria-label="Camera"
      @update:modelValue="emit('camera', $event as CameraMode)" />
    <!-- On a phone the slider needs the room: the icon alone. -->
    <UButton icon="i-lucide-x" color="neutral" variant="outline" aria-label="Exit" class="flex-none" @click="emit('exit')">
      <span class="hidden sm:inline">Exit</span>
    </UButton>
  </div>
</template>

<script setup lang="ts">
  import type { CameraMode } from '@railtime/renderer/transitMap.types';

  import { CAMERA_OPTIONS, DAY_MS, SPEED_OPTIONS } from '~/utils/explorer.constants';

  defineProps<{
    time: number;
    range: { start: number; end: number };
    playing: boolean;
    speed: number;
    camera: CameraMode;
  }>();
  const emit = defineEmits<{
    play: [];
    pause: [];
    skip: [];
    seek: [time: number];
    speed: [speed: number];
    camera: [mode: CameraMode];
    exit: [];
  }>();

  const onSlide = (value: number | number[] | undefined) => {
    if (typeof value === 'number') emit('seek', value);
  };
</script>
