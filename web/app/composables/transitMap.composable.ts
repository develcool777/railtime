import { useColorMode } from '#imports';
import { TransitMap } from '@railtime/renderer/transitMap.service';
import type { LineInfo, MapView, Padding, StationInfo, StepInfo, Theme, TimeState } from '@railtime/renderer/transitMap.types';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import type { TransitMapBinding, TransitMapMount } from './transitMap.composable.types';

/** Below this width the panels stack and the camera keeps less room clear. */
const NARROW_SCREEN = 700;

/**
 * Room the explorer's own panels take, so the camera frames changes clear of them.
 *
 * @returns Padding for the current window size.
 */
const panelPadding = (): Padding => {
  const width = window.innerWidth;
  if (width < NARROW_SCREEN) return { top: 210, bottom: 120, left: 30, right: 30 };
  return { top: 120, bottom: 120, left: Math.min(420, width * 0.3), right: Math.min(280, width * 0.2) };
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
      workerUrl,
      ...(mount.view ? { view: mount.view } : {}),
      ...(mount.language ? { language: mount.language } : {}),
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
      if (station.value) station.value = transitMap.getStationInfo(station.value.id);
    },
  );

  return { map, time, step, revealed, station, lines, view };
};
