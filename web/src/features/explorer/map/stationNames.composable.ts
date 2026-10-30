import type { TransitMap } from '@railtime/renderer/transitMap.service';
import { ref, watch } from 'vue';
import type { Ref, ShallowRef } from 'vue';

/** Where the choice is kept, in this browser. */
const STATION_NAMES_KEY = 'railtime:station-names';

/**
 * Whether the map names its stations: on unless turned off, the choice remembered in this browser.
 *
 * @param map - The map, once mounted.
 * @returns Whether names are shown, and what changes it.
 */
export const useStationNames = (map: ShallowRef<TransitMap | null>): { stationNames: Ref<boolean>; setStationNames: (shown: boolean) => void } => {
  const stationNames = ref(true);

  const setStationNames = (shown: boolean) => {
    stationNames.value = shown;
    map.value?.setStationLabels(shown);
    try {
      localStorage.setItem(STATION_NAMES_KEY, shown ? 'on' : 'off');
    } catch {
      // Storage blocked (a private window): the choice lasts the visit.
    }
  };

  watch(map, transitMap => {
    try {
      if (localStorage.getItem(STATION_NAMES_KEY) === 'off') stationNames.value = false;
    } catch {
      // Storage blocked: names shown.
    }
    transitMap?.setStationLabels(stationNames.value);
  });

  return { stationNames, setStationNames };
};
