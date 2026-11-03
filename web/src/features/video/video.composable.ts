import { TransitMap } from '@railtime/renderer/transitMap.service';
import type { Network } from '@railtime/schema/network.types';
import type { RecordedWindow } from '@railtime/video/videoPage.types';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { onBeforeUnmount, onMounted, type Ref } from 'vue';

import { useVideoStore } from '~/features/video/video.store';

/**
 * The video's map and its frames, and the only code that touches them: on mount, the store opens the
 * network at the frame's size, the map is made with the store's props and listeners that call its
 * actions, each frame gives the store the page's clock (`performance.now`, which a recorder moves
 * itself), and the page's handle tells a recorder where the video is (`VideoPageHandle`). Recorded,
 * the video waits for the recorder to start it; watched, it starts once the map is ready. Everything
 * on the page that moves is worked out from that clock, never left to a CSS transition, which runs on
 * a clock no recorder moves. Client only.
 *
 * @param container - Where the map goes.
 * @param network - The city's network.
 */
export const useVideoMap = (container: Ref<HTMLElement | null>, network: Network): void => {
  const store = useVideoStore();
  const page = window as Window & RecordedWindow;
  let map: TransitMap | null = null;
  let frame = 0;

  /** Each frame: the page's clock to the store. */
  const tick = () => {
    store.tick(performance.now());
    frame = requestAnimationFrame(tick);
  };

  onMounted(() => {
    const element = container.value!;
    store.open(network, { width: element.clientWidth, height: element.clientHeight });
    const props = store.mapProps;
    if (!props) return;
    map = new TransitMap({
      container: element,
      props,
      // The page shows the credits itself, in a corner.
      attributionControl: false,
      workerUrl,
      on: {
        status: () => {
          store.mapReady();
          // Recorded, it starts when the recorder says.
          if (!page.railtimeRecorder) store.start();
        },
        time: state => store.timeChanged(state),
        step: step => store.stepped(step),
        end: () => store.historyEnded(),
      },
    });
    store.attach(map);
    page.railtimeVideo = { state: () => store.pageState, start: store.start };
    frame = requestAnimationFrame(tick);
  });

  onBeforeUnmount(() => {
    cancelAnimationFrame(frame);
    delete page.railtimeVideo;
    store.detach();
    map?.destroy();
    map = null;
  });
};
