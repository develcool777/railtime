import type { TransitMap } from '@railtime/renderer/transitMap.service';
import type { ViewMode } from '@railtime/renderer/transitMap.types';
import { ref } from 'vue';
import type { Ref, ShallowRef } from 'vue';

/**
 * How the map is seen: flat, or in 3D. Flat at every opening: 3D is a look taken, not a setting kept.
 *
 * @param map - The map, once mounted.
 * @returns The view, and what changes it.
 */
export const useViewMode = (map: ShallowRef<TransitMap | null>): { viewMode: Ref<ViewMode>; setViewMode: (mode: ViewMode) => void } => {
  const viewMode = ref<ViewMode>('2d');

  const setViewMode = (mode: ViewMode) => {
    viewMode.value = mode;
    map.value?.setViewMode(mode);
  };

  return { viewMode, setViewMode };
};
