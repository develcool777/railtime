import { useColorMode } from '#imports';
import { TransitMap } from '@railtime/renderer/transitMap.service';
import type { ChangeInfo, LineInfo, MapView, Padding, StationInfo, StepInfo, Theme, TimeState } from '@railtime/renderer/transitMap.types';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import type { TransitMapBinding, TransitMapMount } from './transitMap.composable.types';

/** Below this width the panel is a sheet under the map: the camera keeps less room clear. */
const NARROW_SCREEN = 640;

/**
 * Room the camera keeps clear around what it frames: the panel and dock sit beside the map, not
 * over it, so only the plan legend and the minimap overlap its edges.
 *
 * @returns Padding for the current window size.
 */
const panelPadding = (): Padding => {
  if (window.innerWidth < NARROW_SCREEN) return { top: 32, bottom: 24, left: 24, right: 24 };
  return { top: 64, bottom: 48, left: 48, right: 48 };
};

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
  const revealed = ref(0);
  const station = ref<StationInfo | null>(null);
  const lines = ref<LineInfo[]>([]);
  const changes = ref<ChangeInfo[]>([]);
  // Where it opens, until it first moves: a linked view stays in the address.
  const view = ref<MapView | null>(mount.view ?? null);
  const onResize = () => map.value?.setPadding(panelPadding());

  onMounted(() => {
    const transitMap = new TransitMap({
      container: mount.container.value!,
      minimapContainer: mount.minimapContainer.value ?? undefined,
      network: mount.network,
      theme: theme(),
      padding: panelPadding(),
      // The dock shows the credits, off the map.
      attributionControl: false,
      workerUrl,
      ...(mount.view ? { view: mount.view } : {}),
      ...(mount.plan ? { plan: mount.plan } : {}),
    });
    transitMap.on('time', state => (time.value = state));
    transitMap.on('step', info => {
      step.value = info;
      revealed.value = 0;
    });
    transitMap.on('stepProgress', count => (revealed.value = count));
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

  return { map, time, step, revealed, station, lines, changes, view };
};
