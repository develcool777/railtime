import { required } from '@railtime/core/required.utils';
import { TransitMap } from '@railtime/renderer/transitMap.service';
import type { RecordedWindow } from '@railtime/video/videoPage.types';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { onBeforeUnmount, onMounted, toValue, watch, type MaybeRefOrGetter } from 'vue';
import { useVideoStore } from '~/features/video/video.store';
import type { VideoOpening } from '~/features/video/video.types';
import type { TransitMapMount } from '~/utils/transitMap.types';

/**
 * The video's map and its frames: on mount, the store opens the network at the frame's size, and the
 * map is made with the store's props and listeners that call its actions, and handed to the store.
 * Two things give the map its props. The store sends a beat's before the command it follows them with
 * (`ADVANCE`), since a command acts on the props the map has; the watch here delivers what changes
 * between commands (its outline coming), and repeats a beat's as Vue flushes, which does nothing. Each
 * frame gives the store the page's clock (`performance.now`, which a recorder moves itself), and the
 * page's handle tells a recorder where the video is and whether its frame is drawn (`VideoPageHandle`).
 * Recorded, the video waits for the recorder to start it; watched, it starts once the map is ready.
 * Everything on the page that moves is worked out from that clock, never left to a CSS transition,
 * which runs on a clock no recorder moves. Client only.
 *
 * @param mount - Where the map and the minimap go.
 * @param opening - The city's network, how the map is seen, where its outline is served and the plan named, read as the map is made.
 */
export const useVideoMap = (mount: TransitMapMount, opening: MaybeRefOrGetter<Omit<VideoOpening, 'size'>>): void => {
  const store = useVideoStore();
  const page = window as Window & RecordedWindow;
  let map: TransitMap | null = null;
  let frame = 0;

  /** Each frame: the page's clock to the store. */
  const tick = () => {
    store.TICK(performance.now());
    frame = requestAnimationFrame(tick);
  };

  onMounted(() => {
    // `onMounted`: its element is in the page.
    const element = required(mount.container.value ?? undefined, "the map's element");
    store.OPEN({ ...toValue(opening), size: { width: element.clientWidth, height: element.clientHeight } });
    const props = store.mapProps;
    if (!props) return;
    map = new TransitMap({
      container: element,
      minimapContainer: mount.minimapContainer.value ?? undefined,
      props,
      // The page shows the credits itself, in a corner.
      attributionControl: false,
      workerUrl,
      on: {
        status: () => {
          store.MAP_READY();
          // Recorded, it starts when the recorder says.
          if (!page.railtimeRecorder) store.START();
        },
        time: time => store.SET_TIME(time),
        step: step => store.SET_STEP(step),
        end: () => store.END_PLAYBACK(),
      },
    });
    store.ATTACH(map);
    page.railtimeVideo = { state: () => store.pageState, start: () => store.START(), drawn: () => map?.drawn ?? false };
    frame = requestAnimationFrame(tick);
  });

  watch(
    () => store.mapProps,
    props => props && map?.update(props),
  );

  onBeforeUnmount(() => {
    cancelAnimationFrame(frame);
    delete page.railtimeVideo;
    store.DETACH();
    map?.destroy();
    map = null;
  });
};
