import { NetworkFacts } from '@railtime/network/facts.service';
import type { CoverageInfo, PlanInfo, StepInfo } from '@railtime/network/facts.types';
import type { TransitMap } from '@railtime/renderer/transitMap.service';
import type { Credit, OverlayResult, TimeState, ViewMode } from '@railtime/renderer/transitMap.types';
import type { CityBoundary } from '@railtime/schema/boundary.types';
import type { Network } from '@railtime/schema/network.types';
import { defineStore } from 'pinia';
import { computed, markRaw, nextTick, ref, shallowRef } from 'vue';
import { STORE_IDS } from '~/constants/store.constants';
import type { VideoOpening, VideoScene, VideoSize } from '~/features/video/video.types';
import {
  historySpan,
  isOverview,
  pageStateOf,
  sceneAfter,
  sceneAfterPlayback,
  videoLayersOf,
  videoMapPropsOf,
  videoPlansOf,
} from '~/features/video/video.utils';
import { fetchBoundary } from '~/utils/city.utils';
import { foundCoverageOf } from '~/utils/overlay.utils';

/**
 * A video's state, and what moves it on: the city's network and how it is seen, the plans it plays
 * after today and the one playing, the city's outline and its coverage, the scene shown and since
 * when, where the history is, the change captioned, and the page's clock, read each frame. What shows
 * over the map (`layers`) and what the map shows (`mapProps`) are worked out from them by the rules in
 * `video.utils.ts`; `video.composable.ts` makes the map, gives it `mapProps` as they change, and calls
 * these actions with what it says and with each frame.
 */
export const useVideoStore = defineStore(STORE_IDS.VIDEO, () => {
  // ---- State
  /** The city's network as it is kept, which each plan is laid on. */
  const network = shallowRef<Network | null>(null);
  /** The city's network today, once opened. */
  const facts = shallowRef<NetworkFacts | null>(null);
  /** The plans played after today, in order (`videoPlansOf`). */
  const plans = shallowRef<PlanInfo[]>([]);
  /** The plan shown, by its place in `plans`; -1 before the first. */
  const planIndex = ref(-1);
  /** The city's network with the plan shown laid on it; `null` while none is. */
  const planFacts = shallowRef<NetworkFacts | null>(null);
  /** The city's outline, which coverage is measured within; `null` until it comes, or for none. */
  const boundary = shallowRef<CityBoundary | null>(null);
  /** Where the outline was asked for: an answer from anywhere else is dropped. */
  const outlineAsked = ref<string | null>(null);
  /** The outline has come, or is known to be missing. */
  const outlineSettled = ref(false);
  /** How much of the city the network reaches today, as the map measured it for the overview. */
  const coverage = shallowRef<CoverageInfo | null>(null);
  /** The video's size, once its frame is laid out. */
  const size = ref<VideoSize>({ width: 0, height: 0 });
  /** In 3D, or flat, until the overview. */
  const viewMode = ref<ViewMode>('3d');
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
  /** The network the map shows: with the plan shown laid on it, or today's. */
  const shown = computed(() => planFacts.value ?? facts.value);
  /** The plan shown, for its card; `null` while none is. */
  const plan = computed(() => plans.value[planIndex.value] ?? null);
  /** What the map shows, once there is a network. */
  const mapProps = computed(() =>
    shown.value
      ? videoMapPropsOf({ facts: shown.value, size: size.value, viewMode: viewMode.value, overview: isOverview(scene.value), boundary: boundary.value })
      : null,
  );
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
  const pageState = computed(() => pageStateOf(scene.value, outlineSettled.value));
  /** The years the city's history spans, for the title. */
  const span = computed(() => (facts.value ? historySpan(facts.value.changes()) : ''));

  // ---- Actions
  /**
   * Moves the video on to a scene: the history plays from its start; a plan's card lays the next plan
   * on the network, which then plays from today; the overview takes the network back to today, flat,
   * the whole of it framed once the map has taken its props.
   *
   * @param next - The scene.
   */
  const ENTER = (next: VideoScene) => {
    scene.value = next;
    sceneStartedAt.value = now.value;
    switch (next) {
      case 'history': {
        if (facts.value) map.value?.play(facts.value.playheads.start());
        return;
      }
      case 'planTitle': {
        planIndex.value++;
        const laid = plan.value;
        planFacts.value = network.value && laid ? markRaw(NetworkFacts.create(network.value, { plan: laid.id })) : null;
        return;
      }
      case 'plan': {
        if (planFacts.value) map.value?.play(planFacts.value.playheads.start());
        return;
      }
      case 'overview': {
        planFacts.value = null;
        // Framed flat, once the map lies flat: its props reach it as Vue flushes, before this runs.
        void nextTick(() => map.value?.fitNetwork());
        return;
      }
      case 'loading':
      case 'ready':
      case 'title':
      case 'end':
      case 'done': {
        return;
      }
    }
  };
  /** Back to nothing open: no network, no plan, no outline, no scene, no map. */
  const RESET = () => {
    network.value = null;
    facts.value = null;
    plans.value = [];
    planIndex.value = -1;
    planFacts.value = null;
    boundary.value = null;
    outlineAsked.value = null;
    outlineSettled.value = false;
    coverage.value = null;
    scene.value = 'loading';
    sceneStartedAt.value = 0;
    time.value = null;
    caption.value = null;
    captionGoneAt.value = null;
    credits.value = [];
    map.value = null;
  };
  /**
   * Fetches the city's outline, which coverage is measured within; one that comes once another city
   * is open is dropped.
   *
   * @param url - Where it is served.
   */
  const LOAD_BOUNDARY = async (url: string) => {
    outlineAsked.value = url;
    outlineSettled.value = false;
    const outline = await fetchBoundary(url);
    if (outlineAsked.value !== url) return;
    boundary.value = outline && markRaw(outline);
    outlineSettled.value = true;
  };
  /**
   * Opens a city's network, the video not started, and asks for its outline.
   *
   * @param opening - The network, the frame's size, how the map is seen, and where the outline is served.
   */
  const OPEN = (opening: VideoOpening) => {
    RESET();
    network.value = markRaw(opening.network);
    facts.value = markRaw(NetworkFacts.create(opening.network));
    plans.value = videoPlansOf(facts.value.plans(), facts.value.planOnly);
    size.value = opening.size;
    viewMode.value = opening.viewMode;
    void LOAD_BOUNDARY(opening.outline);
  };
  /**
   * Takes the map, once it is made.
   *
   * @param mounted - The map.
   */
  const ATTACH = (mounted: TransitMap) => {
    map.value = markRaw(mounted);
  };
  /** Lets the map go, as it is taken down. */
  const DETACH = () => {
    map.value = null;
  };
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
  const SET_TIME = (state: TimeState) => {
    time.value = state;
  };
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
    } else captionGoneAt.value ??= now.value;
  };
  /**
   * What the map found for the overlay drawn: the overview's coverage.
   *
   * @param result - What it found, or `null` once the overlay is cleared.
   */
  const SET_OVERLAY = (result: OverlayResult | null) => {
    coverage.value = foundCoverageOf(result);
  };
  /** The history, or a plan, has played to its end: the next plan's card, or the whole network from above. */
  const END_PLAYBACK = () => {
    if (scene.value !== 'history' && scene.value !== 'plan') return;
    ENTER(sceneAfterPlayback(planIndex.value + 1 < plans.value.length));
  };

  return {
    // State
    network,
    facts,
    plans,
    planIndex,
    planFacts,
    boundary,
    outlineAsked,
    outlineSettled,
    coverage,
    size,
    viewMode,
    now,
    scene,
    sceneStartedAt,
    time,
    caption,
    captionShownAt,
    captionGoneAt,
    credits,
    map,
    // Getters
    shown,
    plan,
    mapProps,
    layers,
    pageState,
    span,
    // Actions
    RESET,
    LOAD_BOUNDARY,
    OPEN,
    ATTACH,
    DETACH,
    MAP_READY,
    START,
    TICK,
    SET_TIME,
    SET_STEP,
    SET_OVERLAY,
    END_PLAYBACK,
  };
});
