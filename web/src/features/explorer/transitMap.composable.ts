import { useColorMode } from '#imports';
import { TransitMap } from '@railtime/renderer/transitMap.service';
import type { ChangeInfo, LineInfo, MapView, StationInfo, StepInfo, Theme, TimeState } from '@railtime/renderer/transitMap.types';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import type { TransitMapBinding, TransitMapMount } from './transitMap.composable.types';

/**
 * Mounts a `TransitMap` and mirrors its events as reactive state; follows the site's colour mode.
 * Commands go straight to `map.value`. Client only: call it inside `<ClientOnly>`.
 *
 * @param mount - Where to mount the map and minimap, and the network to draw.
 * @returns The map and its state.
 */
export const useTransitMap = (mount: TransitMapMount): TransitMapBinding => {
  const colorMode = useColorMode();
  const theme = (): Theme => (colorMode.value === 'light' ? 'light' : 'dark');
  const map = shallowRef<TransitMap | null>(null);
  const time = ref<TimeState | null>(null);
  const step = ref<StepInfo | null>(null);
  const station = ref<StationInfo | null>(null);
  const lines = ref<LineInfo[]>([]);
  const changes = ref<ChangeInfo[]>([]);
  // Where it opens, until it first moves: a linked view stays in the address.
  const view = ref<MapView | null>(mount.view ?? null);
  const onResize = () => map.value?.setPadding(mount.padding());

  onMounted(() => {
    const transitMap = new TransitMap({
      container: mount.container.value!,
      minimapContainer: mount.minimapContainer.value ?? undefined,
      network: mount.network,
      theme: theme(),
      padding: mount.padding(),
      // The page shows the credits itself, in a corner of the map.
      attributionControl: false,
      workerUrl,
      ...(mount.view ? { view: mount.view } : {}),
      ...(mount.plan ? { plan: mount.plan } : {}),
    });
    transitMap.on('time', state => (time.value = state));
    transitMap.on('step', info => (step.value = info));
    transitMap.on('view', where => (view.value = where));
    transitMap.on('stationClick', info => {
      station.value = info;
      transitMap.selectStation(info?.id ?? null);
    });
    lines.value = transitMap.getLines();
    changes.value = transitMap.getChanges();
    map.value = transitMap;
    window.addEventListener('resize', onResize);
  });

  onBeforeUnmount(() => {
    window.removeEventListener('resize', onResize);
    map.value?.destroy();
  });

  watch(
    () => colorMode.value,
    () => {
      const transitMap = map.value;
      if (!transitMap) return;
      transitMap.setTheme(theme());
      lines.value = transitMap.getLines();
      changes.value = transitMap.getChanges();
      if (station.value) station.value = transitMap.getStationInfo(station.value.id);
    },
  );

  return { map, time, step, station, lines, changes, view };
};
