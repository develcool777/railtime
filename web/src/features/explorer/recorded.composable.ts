import type { RecordedWindow } from '@railtime/video/videoPage.types';
import { onBeforeUnmount, onMounted } from 'vue';
import { recordedStateOf } from '~/features/explorer/explorer.utils';
import { useMapStore } from '~/features/explorer/map/map.store';
import { useTimeStore } from '~/features/explorer/time/time.store';

/**
 * The explorer's handle for a recorder, on the page's `window`, as the video page's
 * (`VideoPageHandle`): where it is, how to start it playing, and whether the frame is drawn. An effect,
 * and nothing else; under `pnpm dev` only, as recording is. Client only: call it from the frame, whose
 * map is made on mount.
 */
export const useRecordedExplorer = (): void => {
  if (!import.meta.dev) return;
  const mapStore = useMapStore();
  const timeStore = useTimeStore();

  onMounted(() => {
    const page = window as Window & RecordedWindow;
    page.railtimeVideo = {
      state: () =>
        recordedStateOf({
          status: mapStore.map?.status ?? 'loading',
          settled: mapStore.map?.settled ?? false,
          playing: timeStore.playerShown,
          playedOut: timeStore.playedOut,
        }),
      start: () => timeStore.PLAY(),
      drawn: () => mapStore.map?.drawn ?? false,
    };
  });

  onBeforeUnmount(() => {
    delete (window as Window & RecordedWindow).railtimeVideo;
  });
};
