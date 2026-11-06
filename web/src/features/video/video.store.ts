import { NetworkFacts } from '@railtime/network/facts.service';
import type { StepInfo } from '@railtime/network/facts.types';
import type { TransitMap } from '@railtime/renderer/transitMap.service';
import type { Credit, TimeState, ViewMode } from '@railtime/renderer/transitMap.types';
import type { CityBoundary } from '@railtime/schema/boundary.types';
import type { Network } from '@railtime/schema/network.types';
import { defineStore } from 'pinia';
import { computed, markRaw, ref, shallowRef } from 'vue';
import { STORE_IDS } from '~/constants/store.constants';
import { insightsMotionOf, planGainOf, videoInsightsOf } from '~/features/video/insights/insights.utils';
import { WHOLE_FIT_MS } from '~/features/video/video.constants';
import type { VideoBeat, VideoOpening, VideoSize } from '~/features/video/video.types';
import { historySpan, pageStateOf, sceneEnded, videoLayersOf, videoMapPropsOf, videoPlanOf, videoScriptOf } from '~/features/video/video.utils';
import { fetchAskedBoundary } from '~/utils/city.utils';

/**
 * A video's state, and what moves it on: the city's network and how it is seen, the script it follows
 * and the beat it is at, since when, the city's outline, where the history is, the change captioned,
 * and the page's clock, read each frame. The script says what each beat is (`videoScriptOf`); what
 * shows over the map (`layers`, `insights`) and what the map shows (`mapProps`) are worked out from the
 * beat by the rules in `video.utils.ts` and `insights/insights.utils.ts`. `video.composable.ts` makes
 * the map, delivers what changes in `mapProps` between commands, and calls these actions with what the
 * map says and with each frame; a beat's own props and commands go to the map from `ADVANCE`.
 */
export const useVideoStore = defineStore(STORE_IDS.VIDEO, () => {
  // ---- State
  /** The city's network as it is kept, which each plan is laid on. */
  const network = shallowRef<Network | null>(null);
  /** The city's network today, once opened. */
  const facts = shallowRef<NetworkFacts | null>(null);
  /** The video, beat by beat, once opened. */
  const script = shallowRef<VideoBeat[]>([]);
  /** The beat it is at, by its place in the script; -1 while its map loads. */
  const beatIndex = ref(-1);
  /** The city's outline, which coverage is measured within; `null` until it comes, or for none. */
  const boundary = shallowRef<CityBoundary | null>(null);
  /** Where the outline was asked for: an answer from anywhere else is dropped. */
  const outlineAsked = ref<string | null>(null);
  /** The outline has come, or is known to be missing. */
  const outlineSettled = ref(false);
  /** The video's size, once its frame is laid out. */
  const size = ref<VideoSize>({ width: 0, height: 0 });
  /** In 3D, or flat, while it plays. */
  const viewMode = ref<ViewMode>('3d');
  /** The page's clock, ms: moved on each frame, by the recorder when one records it. */
  const now = ref(0);
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
  /** The beat the video is at; `null` while its map loads. */
  const beat = computed(() => script.value[beatIndex.value] ?? null);
  /** The scene shown. */
  const scene = computed(() => beat.value?.scene ?? 'loading');
  /** How the map is seen. */
  const framing = computed(() => beat.value?.framing ?? 'playing');
  /** The plan laid on the network, for the end card; `null` while none is. */
  const plan = computed(() => beat.value?.plan ?? null);
  /** The city's network with that plan laid on it, made once for the beats that share it; `null` while none is. */
  const planFacts = computed(() => (network.value && plan.value ? markRaw(NetworkFacts.create(network.value, { plan: plan.value.id })) : null));
  /** The network the map shows: with the beat's plan laid on it, or today's. */
  const shown = computed(() => planFacts.value ?? facts.value);
  /** What the map shows, once there is a network. */
  const mapProps = computed(() =>
    shown.value ? videoMapPropsOf({ facts: shown.value, size: size.value, viewMode: viewMode.value, framing: framing.value, boundary: boundary.value }) : null,
  );
  /** How much of each piece over the map shows this frame. */
  const layers = computed(() =>
    videoLayersOf({
      scene: scene.value,
      planned: plan.value !== null,
      elapsed: now.value - sceneStartedAt.value,
      sinceCaption: now.value - captionShownAt.value,
      sinceCaptionGone: captionGoneAt.value === null ? null : now.value - captionGoneAt.value,
    }),
  );
  /** The network's numbers for the panels, while they show. */
  const insights = computed(() => (framing.value === 'insights' && facts.value ? videoInsightsOf(facts.value, boundary.value) : null));
  /** What the plan changes, for its end card, while that shows. */
  const planGain = computed(() =>
    framing.value === 'ending' && facts.value && planFacts.value ? planGainOf(facts.value, planFacts.value, boundary.value) : null,
  );
  /** How far each panel has come this frame: they go with their scene if the next beat has none. */
  const insightsMotion = computed(() =>
    insightsMotionOf(scene.value, now.value - sceneStartedAt.value, script.value[beatIndex.value + 1]?.framing !== 'insights'),
  );
  /** How long the end card's numbers have counted, ms: rested on once its scene is over. */
  const endCounted = computed(() => (scene.value === 'end' ? now.value - sceneStartedAt.value : Infinity));
  /** Where the video is, as the page tells a recorder. */
  const pageState = computed(() => pageStateOf(scene.value, outlineSettled.value));
  /** The years the city's history spans, for the title. */
  const span = computed(() => (facts.value ? historySpan(facts.value.changes()) : ''));

  // ---- Actions
  /**
   * Moves the video on to its next beat: the map given what the beat shows, then told what it does with
   * it, as a command acts on the props the map has: the history played from its start, the plan from
   * its start on the plan's network, the whole network framed flat. The effect gives the same props
   * again as Vue flushes, which does nothing.
   */
  const ADVANCE = () => {
    beatIndex.value++;
    sceneStartedAt.value = now.value;
    if (mapProps.value) map.value?.update(mapProps.value);
    switch (scene.value) {
      case 'history': {
        if (facts.value) map.value?.play(facts.value.playheads.start());
        return;
      }
      case 'plan': {
        if (planFacts.value) map.value?.play(planFacts.value.playheads.start());
        return;
      }
      case 'insights':
      case 'overview':
      case 'end': {
        map.value?.fitNetwork(WHOLE_FIT_MS);
        return;
      }
      case 'loading':
      case 'ready':
      case 'title':
      case 'done': {
        return;
      }
    }
  };
  /** Back to nothing open: no network, no script, no outline, no map. */
  const RESET = () => {
    network.value = null;
    facts.value = null;
    script.value = [];
    beatIndex.value = -1;
    boundary.value = null;
    outlineAsked.value = null;
    outlineSettled.value = false;
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
    await fetchAskedBoundary(
      url,
      () => outlineAsked.value,
      outline => {
        boundary.value = outline && markRaw(outline);
        outlineSettled.value = true;
      },
    );
  };
  /**
   * Opens a city's network, the video not started, and asks for its outline: its script goes on past
   * today to the plan its address names, if the network has it.
   *
   * @param opening - The network, the frame's size, how the map is seen, where the outline is served, and the plan named.
   */
  const OPEN = (opening: VideoOpening) => {
    RESET();
    network.value = markRaw(opening.network);
    facts.value = markRaw(NetworkFacts.create(opening.network));
    script.value = videoScriptOf(videoPlanOf(facts.value.plans(), facts.value.planOnly, opening.plan));
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
    if (scene.value !== 'loading' || !facts.value || !map.value) return;
    map.value.seek(facts.value.playheads.start());
    credits.value = map.value.credits;
    ADVANCE();
  };
  /** Starts the video, once ready. */
  const START = () => {
    if (scene.value === 'ready') ADVANCE();
  };
  /**
   * A frame: the clock moved on, and the video with it as its scene's time runs out.
   *
   * @param frameTime - The page's clock, ms.
   */
  const TICK = (frameTime: number) => {
    now.value = frameTime;
    if (sceneEnded(scene.value, frameTime - sceneStartedAt.value)) ADVANCE();
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
  /** The history, or the plan, has played to its end: on to the next beat. */
  const END_PLAYBACK = () => {
    if (scene.value === 'history' || scene.value === 'plan') ADVANCE();
  };

  return {
    // State
    network,
    facts,
    script,
    beatIndex,
    boundary,
    outlineAsked,
    outlineSettled,
    size,
    viewMode,
    now,
    sceneStartedAt,
    time,
    caption,
    captionShownAt,
    captionGoneAt,
    credits,
    map,
    // Getters
    beat,
    scene,
    framing,
    plan,
    planFacts,
    shown,
    mapProps,
    layers,
    insights,
    planGain,
    insightsMotion,
    endCounted,
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
    END_PLAYBACK,
  };
});
