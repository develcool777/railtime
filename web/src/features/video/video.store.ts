import { NetworkFacts } from '@railtime/network/facts.service';
import type { StepInfo } from '@railtime/network/facts.types';
import type { TransitMap } from '@railtime/renderer/transitMap.service';
import type { Credit, TimeState } from '@railtime/renderer/transitMap.types';
import { defineStore } from 'pinia';
import { computed, markRaw, ref, shallowRef } from 'vue';

import { STORE_IDS } from '~/constants/store.constants';
import type { VideoOpening, VideoScene, VideoSize } from '~/features/video/video.types';
import { historySpan, pageStateOf, sceneAfter, videoLayersOf, videoMapPropsOf } from '~/features/video/video.utils';

/**
 * A video's state, and what moves it on: the city's network, the scene shown and
 * since when, where the history is, the change captioned, and the page's clock, read each frame.
 * What shows over the map (`layers`) and what the map shows (`mapProps`) are worked out from them by
 * the rules in `video.utils.ts`; `video.composable.ts` makes the map, gives it `mapProps`, and calls
 * these actions with what it says and with each frame.
 */
export const useVideoStore = defineStore(STORE_IDS.VIDEO, () => {
  // ---- State
  /** The city's network, once opened. */
  const facts = shallowRef<NetworkFacts | null>(null);
  /** The video's size, once its frame is laid out. */
  const size = ref<VideoSize>({ width: 0, height: 0 });
  /** The page's clock, ms: moved on each frame, by the recorder when one records it. */
  const now = ref(0);
  const scene = ref<VideoScene>('loading');
  const sceneStartedAt = ref(0);
  /** Where the history is, and the network's size there. */
  const time = shallowRef<TimeState | null>(null);
  /** The change last captioned, kept while its caption fades out. */
  const caption = shallowRef<StepInfo | null>(null);
  const captionShownAt = ref(0);
  /** When its caption went, or `null` while it shows. */
  const captionGoneAt = ref<number | null>(null);
  /** What the map owes credit to, once it is ready. */
  const credits = shallowRef<Credit[]>([]);
  /** The map, while mounted. */
  const map = shallowRef<TransitMap | null>(null);

  // ---- Getters
  /** What the map shows, once there is a network. */
  const mapProps = computed(() => (facts.value ? videoMapPropsOf(facts.value, size.value) : null));
  /** How much of each piece over the map shows this frame. */
  const layers = computed(() =>
    videoLayersOf({
      scene: scene.value,
      elapsed: now.value - sceneStartedAt.value,
      sinceCaption: now.value - captionShownAt.value,
      sinceCaptionGone: captionGoneAt.value === null ? null : now.value - captionGoneAt.value,
    }),
  );
  /** Where the video is, as the page tells a recorder. */
  const pageState = computed(() => pageStateOf(scene.value));
  /** The years the city's history spans, for the title. */
  const span = computed(() => (facts.value ? historySpan(facts.value.changes()) : ''));

  // ---- Actions
  /**
   * Moves the video on to a scene: the history plays from its start as it comes.
   *
   * @param next - The scene.
   */
  const ENTER = (next: VideoScene) => {
    scene.value = next;
    sceneStartedAt.value = now.value;
    if (next === 'history' && facts.value) map.value?.play(facts.value.playheads.start());
  };
  /** Back to nothing open: no network, no scene, no map. */
  const RESET = () => {
    facts.value = null;
    scene.value = 'loading';
    sceneStartedAt.value = 0;
    time.value = null;
    caption.value = null;
    captionGoneAt.value = null;
    credits.value = [];
    map.value = null;
  };
  /**
   * Opens a city's network, the video not started.
   *
   * @param opening - The network, and the frame's size.
   */
  const OPEN = (opening: VideoOpening) => {
    RESET();
    facts.value = markRaw(NetworkFacts.create(opening.network));
    size.value = opening.size;
  };
  /**
   * Takes the map, once it is made.
   *
   * @param mounted - The map.
   */
  const ATTACH = (mounted: TransitMap) => (map.value = markRaw(mounted));
  /** Lets the map go, as it is taken down. */
  const DETACH = () => (map.value = null);
  /** The map is ready: at the history's start, nothing built, and the video ready to start. */
  const MAP_READY = () => {
    if (!facts.value || !map.value) return;
    map.value.seek(facts.value.playheads.start());
    credits.value = map.value.credits;
    ENTER('ready');
  };
  /** Starts the video, once ready. */
  const START = () => {
    if (scene.value === 'ready') ENTER('title');
  };
  /**
   * A frame: the clock moved on, and the scene with it as its time runs out.
   *
   * @param frameTime - The page's clock, ms.
   */
  const TICK = (frameTime: number) => {
    now.value = frameTime;
    const next = sceneAfter(scene.value, frameTime - sceneStartedAt.value);
    if (next !== scene.value) ENTER(next);
  };
  /**
   * The history moved on.
   *
   * @param state - Where it is.
   */
  const SET_TIME = (state: TimeState) => (time.value = state);
  /**
   * A change starts, captioned; or its caption should go.
   *
   * @param step - The change, or `null`.
   */
  const SET_STEP = (step: StepInfo | null) => {
    if (step) {
      caption.value = step;
      captionShownAt.value = now.value;
      captionGoneAt.value = null;
    } else if (captionGoneAt.value === null) captionGoneAt.value = now.value;
  };
  /** The history has played to today: the end card. */
  const END_HISTORY = () => ENTER('end');

  return {
    // State
    facts,
    scene,
    time,
    caption,
    credits,
    // Getters
    mapProps,
    layers,
    pageState,
    span,
    // Actions
    RESET,
    OPEN,
    ATTACH,
    DETACH,
    MAP_READY,
    START,
    TICK,
    SET_TIME,
    SET_STEP,
    END_HISTORY,
  };
});
