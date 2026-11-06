import { NetworkFacts } from '@railtime/network/facts.service';
import type { NetworkStats, StepInfo } from '@railtime/network/facts.types';
import type { TransitMap } from '@railtime/renderer/transitMap.service';
import type { Credit, TimeState, ViewMode } from '@railtime/renderer/transitMap.types';
import type { CityBoundary } from '@railtime/schema/boundary.types';
import type { Network } from '@railtime/schema/network.types';
import { defineStore } from 'pinia';
import { computed, markRaw, nextTick, ref, shallowRef } from 'vue';
import { STORE_IDS } from '~/constants/store.constants';
import { insightsMotionOf, videoInsightsOf } from '~/features/video/insights/insights.utils';
import { COUNT_MS, WHOLE_FIT_MS } from '~/features/video/video.constants';
import type { VideoBeat, VideoOpening, VideoSize } from '~/features/video/video.types';
import {
  easedOut,
  fadedIn,
  historySpan,
  pageStateOf,
  sameStats,
  sceneEnded,
  statsBetween,
  videoLayersOf,
  videoMapPropsOf,
  videoPlanOf,
  videoScriptOf,
} from '~/features/video/video.utils';
import { fetchBoundary } from '~/utils/city.utils';

/** A network with nothing on it, where the numbers start. */
const NO_STATS: NetworkStats = { stations: 0, km: 0, lines: 0 };

/**
 * A video's state, and what moves it on: the city's network and how it is seen, the script it follows
 * and the beat it is at, since when, the city's outline, where the history is, the change captioned,
 * and the page's clock, read each frame. The script says what each beat is (`videoScriptOf`); what
 * shows over the map (`layers`, `insights`) and what the map shows (`mapProps`) are worked out from the
 * beat by the rules in `video.utils.ts` and `insights/insights.utils.ts`. `video.composable.ts` makes
 * the map, gives it `mapProps` as they change, and calls these actions with what it says and with each
 * frame.
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
  /** The city's network with the beat's plan laid on it; `null` while none is. */
  const planFacts = shallowRef<NetworkFacts | null>(null);
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
  /** What the numbers count from, and to, and when they started to. */
  const countFrom = shallowRef<NetworkStats>(NO_STATS);
  const countTo = shallowRef<NetworkStats>(NO_STATS);
  const countedAt = ref(0);
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
      elapsed: now.value - sceneStartedAt.value,
      sinceCaption: now.value - captionShownAt.value,
      sinceCaptionGone: captionGoneAt.value === null ? null : now.value - captionGoneAt.value,
    }),
  );
  /** The network's numbers for the panels, while they show. */
  const insights = computed(() => (framing.value === 'insights' && facts.value ? videoInsightsOf(facts.value, boundary.value) : null));
  /** How far each panel has come this frame: they go with their scene if the next beat has none. */
  const insightsMotion = computed(() =>
    insightsMotionOf(scene.value, now.value - sceneStartedAt.value, script.value[beatIndex.value + 1]?.framing !== 'insights'),
  );
  /** The network's size as the year card shows it this frame, counting to where the history is. */
  const stats = computed(() => statsBetween(countFrom.value, countTo.value, easedOut(fadedIn(now.value - countedAt.value, COUNT_MS))));
  /** Where the video is, as the page tells a recorder. */
  const pageState = computed(() => pageStateOf(scene.value, outlineSettled.value));
  /** The years the city's history spans, for the title. */
  const span = computed(() => (facts.value ? historySpan(facts.value.changes()) : ''));

  // ---- Actions
  /**
   * Moves the video on to its next beat: the plan it asks for laid on the network, or taken off; the
   * history played from its start; the plan from its start, and the whole network framed, once the map
   * has taken its props.
   */
  const ADVANCE = () => {
    const before = plan.value;
    beatIndex.value++;
    sceneStartedAt.value = now.value;
    if (plan.value !== before) planFacts.value = network.value && plan.value ? markRaw(NetworkFacts.create(network.value, { plan: plan.value.id })) : null;
    switch (scene.value) {
      case 'history': {
        if (facts.value) map.value?.play(facts.value.playheads.start());
        return;
      }
      case 'plan': {
        // On the plan's network, once the map has it: its props reach it as Vue flushes, before this runs.
        void nextTick(() => {
          if (planFacts.value) map.value?.play(planFacts.value.playheads.start());
        });
        return;
      }
      case 'insights':
      case 'overview': {
        // Framed flat, once the map lies flat: its props reach it as Vue flushes, before this runs.
        void nextTick(() => map.value?.fitNetwork(WHOLE_FIT_MS));
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
  /** Back to nothing open: no network, no script, no outline, no map. */
  const RESET = () => {
    network.value = null;
    facts.value = null;
    script.value = [];
    beatIndex.value = -1;
    planFacts.value = null;
    boundary.value = null;
    outlineAsked.value = null;
    outlineSettled.value = false;
    sceneStartedAt.value = 0;
    time.value = null;
    countFrom.value = NO_STATS;
    countTo.value = NO_STATS;
    countedAt.value = 0;
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
   * The history moved on: the numbers count on from where they are, if it changed them.
   *
   * @param state - Where it is.
   */
  const SET_TIME = (state: TimeState) => {
    time.value = state;
    if (sameStats(state.stats, countTo.value)) return;
    countFrom.value = stats.value;
    countTo.value = state.stats;
    countedAt.value = now.value;
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
    planFacts,
    boundary,
    outlineAsked,
    outlineSettled,
    size,
    viewMode,
    now,
    sceneStartedAt,
    time,
    countFrom,
    countTo,
    countedAt,
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
    shown,
    mapProps,
    layers,
    insights,
    insightsMotion,
    stats,
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
