<template>
  <UPopover :content="{ align: 'end', side: 'top', sideOffset: 8 }">
    <UTooltip text="Player settings">
      <UButton
        icon="i-lucide-settings-2"
        color="neutral"
        variant="outline"
        square
        class="size-9 flex-none justify-center rounded-full"
        aria-label="Player settings" />
    </UTooltip>

    <template #content>
      <div class="flex w-72 flex-col gap-4 p-4" role="group" aria-label="Player settings">
        <div class="flex flex-col gap-1.5">
          <p class="text-highlighted text-xs font-bold">Speed</p>
          <UTabs
            :modelValue="settings.speed"
            :items="SPEED_OPTIONS"
            :content="false"
            size="sm"
            aria-label="Speed"
            @update:modelValue="emit('change', { speed: Number($event) })" />
        </div>

        <div class="flex flex-col gap-1.5">
          <p class="text-highlighted text-xs font-bold">Camera</p>
          <UTabs
            :modelValue="settings.camera"
            :items="CAMERA_OPTIONS"
            :content="false"
            size="sm"
            aria-label="Camera"
            @update:modelValue="emit('change', { camera: $event as CameraMode })" />
          <p class="text-muted text-xs">{{ cameraDescription }}</p>
        </div>

        <USwitch
          :modelValue="viewMode === '3d'"
          label="See in 3D"
          description="Close up, over the city’s buildings"
          @update:modelValue="emit('viewMode', $event ? '3d' : '2d')" />
        <USwitch
          v-if="!phone"
          :modelValue="settings.minimap"
          label="Minimap"
          description="The whole city, and where the camera is"
          @update:modelValue="emit('change', { minimap: $event })" />
      </div>
    </template>
  </UPopover>
</template>

<script setup lang="ts">
  import type { CameraMode, ViewMode } from '@railtime/renderer/transitMap.types';
  import { computed } from 'vue';

  import type { PlayerSettings } from '~/features/explorer/explorer.types';
  import { CAMERA_OPTIONS, SPEED_OPTIONS } from '~/features/explorer/time/time.constants';

  const props = defineProps<{
    settings: PlayerSettings;
    /** How the map is seen: flat, or in 3D. */
    viewMode: ViewMode;
    /** On a phone: no minimap. */
    phone: boolean;
  }>();
  const emit = defineEmits<{ change: [change: Partial<PlayerSettings>]; viewMode: [mode: ViewMode] }>();

  const cameraDescription = computed(() => CAMERA_OPTIONS.find(option => option.value === props.settings.camera)?.description ?? '');
</script>
