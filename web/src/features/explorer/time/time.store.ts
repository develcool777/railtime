import { endOfYear, yearOf } from '@railtime/core/date.utils';
import type { NetworkFacts } from '@railtime/network/facts.service';
import type { Playhead, StepInfo } from '@railtime/network/facts.types';
import type { TimeState } from '@railtime/renderer/transitMap.types';
import { defineStore } from 'pinia';
import { computed, ref, shallowRef } from 'vue';
import { STORE_IDS } from '~/constants/store.constants';
import type { ExplorerUrlState, LinkedPlayhead } from '~/features/explorer/address/address.types';
import { linkedPlayheadOf, playheadOf } from '~/features/explorer/address/address.utils';
import type { PlayerSettings, TimeMode } from '~/features/explorer/explorer.types';
import { useMapStore } from '~/features/explorer/map/map.store';
import { useNetworkStore } from '~/features/explorer/network.store';
import { DEFAULT_PLAYER } from '~/features/explorer/time/time.constants';
import type { TimelineTarget } from '~/features/explorer/time/timeline.types';

/**
 * Time in the explorer: what the time control shows (the timeline, or the player), how playback is
 * set, where the history is and the change playing, as the map tells them; and every command that
 * moves through time, sent to the map. It reads the network shown and the map.
 */
export const useTimeStore = defineStore(STORE_IDS.EXPLORER_TIME, () => {
  const network = useNetworkStore();
  const mapStore = useMapStore();

  // ---- State
  /** What the time control shows: the timeline, or the player. */
  const timeMode = ref<TimeMode>('timeline');
  /** How playback is set: its speed, its camera, the minimap. */
  const player = ref<PlayerSettings>({ ...DEFAULT_PLAYER });
  /** Where the history is, as the map tells it; `null` before it has. */
  const time = shallowRef<TimeState | null>(null);
  /** The change playing, as the map tells it. */
  const step = shallowRef<StepInfo | null>(null);
  /** Where in the history the address opened, for the map once it is there. */
  const openingAt = shallowRef<LinkedPlayhead | null>(null);

  // ---- Getters
  /** The time control shows the player (playing, or paused in it); the map moving is `time.playing`. */
  const playerShown = computed(() => timeMode.value === 'playing');
  /** Where the history is, as the address names it: as it opened, until the map tells it. */
  const linkedPlayhead = computed(() => (time.value && network.facts ? linkedPlayheadOf(time.value, network.facts.playheads) : openingAt.value));
  /** The date shown, for what had opened by then; `null` in a plan, or before the map tells it. */
  const shownDate = computed(() => (!time.value || time.value.inPlan ? null : time.value.time));
  /** The year shown; `null` in a plan. */
  const shownYear = computed(() => (shownDate.value === null ? null : yearOf(shownDate.value)));

  // ---- Actions
  /**
   * Sets time for a page opening: the timeline, playback set as the address says, where in the
   * history it asks for, nothing told yet.
   *
   * @param address - What the address asks for.
   */
  const OPEN = (address: ExplorerUrlState) => {
    timeMode.value = 'timeline';
    player.value = {
      speed: address.speed ?? DEFAULT_PLAYER.speed,
      camera: address.camera ?? DEFAULT_PLAYER.camera,
      minimap: address.minimap ?? DEFAULT_PLAYER.minimap,
    };
    time.value = null;
    step.value = null;
    openingAt.value = address.at ?? null;
  };
  /**
   * Moves the map to a playhead of the network shown.
   *
   * @param where - Picks it from the network's playheads.
   */
  const SEEK = (where: (playheads: NetworkFacts['playheads']) => Playhead) => {
    if (network.facts) mapStore.map?.seek(where(network.facts.playheads));
  };
  /** The map has arrived: it is shown where the address opened, or with the plan built. */
  const SEEK_OPENING = () => {
    const opening = openingAt.value;
    if (opening) SEEK(playheads => playheadOf(opening, playheads));
    else if (network.plan) SEEK(playheads => playheads.end());
  };
  /** Back to the timeline, no change playing: the network made again, at its today. */
  const TO_TIMELINE = () => {
    timeMode.value = 'timeline';
    step.value = null;
  };
  /**
   * The map moved through time.
   *
   * @param next - Where it is.
   */
  const SET_TIME = (next: TimeState) => {
    time.value = next;
  };
  /**
   * A change started, or its caption should go.
   *
   * @param next - The change, or `null`.
   */
  const SET_STEP = (next: StepInfo | null) => {
    step.value = next;
  };
  /** Playback reached its end: the timeline, at today. */
  const PLAYBACK_ENDED = () => {
    if (playerShown.value) timeMode.value = 'timeline';
  };
  /**
   * Changes how playback is set.
   *
   * @param change - The settings changed.
   */
  const SET_PLAYER = (change: Partial<PlayerSettings>) => {
    player.value = { ...player.value, ...change };
  };
  /**
   * Plays on from the date the timeline stands at, where it was dragged or paused (from the start
   * again once at its end); the panel stays on what is open in it (Changes, open, follows along).
   */
  const PLAY = () => {
    timeMode.value = 'playing';
    mapStore.map?.play();
  };
  /** Pauses where it is: the timeline, at the date reached. */
  const PAUSE = () => {
    mapStore.map?.pause();
    timeMode.value = 'timeline';
  };
  /** Pauses while the map moves in the player; else plays. */
  const TOGGLE_PLAY = () => {
    if (playerShown.value && time.value?.playing) PAUSE();
    else PLAY();
  };
  /**
   * Leaves for one of the network's places: today, where the map rests (today, or a plan built) or the
   * end; in the player, it stops, the whole network back in view.
   *
   * @param place - Where to, as `Playheads` names it.
   */
  const LEAVE_TO = (place: 'today' | 'rest' | 'end') => {
    if (playerShown.value) mapStore.map?.stop();
    timeMode.value = 'timeline';
    SEEK(playheads => playheads[place]());
  };
  /** The change before the one shown; in the player, it plays again. */
  const PREVIOUS_CHANGE = () => {
    mapStore.map?.previousChange();
  };
  /** Finishes the change playing, or goes to the next one. */
  const NEXT_CHANGE = () => {
    mapStore.map?.skip();
  };
  /**
   * Shows what the timeline was picked at: in the player, it plays on from there.
   *
   * @param target - A date, a change, or the plan built.
   */
  const PICK = (target: TimelineTarget) => {
    if (target.kind === 'planBuilt') SEEK(playheads => playheads.end());
    else if (target.kind === 'change') SEEK(playheads => playheads.after(target.index + 1));
    else SEEK(playheads => playheads.on(target.time));
  };
  /**
   * A change picked in a list: in the player, playback goes back to play it; otherwise the map shows it.
   *
   * @param index - The change.
   */
  const PICK_CHANGE = (index: number) => {
    if (playerShown.value && network.facts) mapStore.map?.play(network.facts.playheads.before(index));
    else SEEK(playheads => playheads.after(index + 1));
  };
  /**
   * A year back or on; in the player, the change before or the next.
   *
   * @param direction - Back (-1) or on (1).
   */
  const STEP_TIME = (direction: -1 | 1) => {
    if (network.planOnly) return;
    if (!playerShown.value) mapStore.map?.stepYear(direction);
    else if (direction > 0) mapStore.map?.skip();
    else mapStore.map?.previousChange();
  };
  /**
   * A year picked on a chart: the map at its end (today, for this year), which the timeline shows.
   *
   * @param year - The year.
   */
  const SHOW_YEAR = (year: number) => {
    SEEK(playheads => playheads.on(Math.min(endOfYear(year), playheads.today().time)));
  };

  return {
    // State
    timeMode,
    player,
    time,
    step,
    // Getters
    playerShown,
    linkedPlayhead,
    shownDate,
    shownYear,
    // Actions
    OPEN,
    SEEK,
    SEEK_OPENING,
    TO_TIMELINE,
    SET_TIME,
    SET_STEP,
    PLAYBACK_ENDED,
    SET_PLAYER,
    PLAY,
    PAUSE,
    TOGGLE_PLAY,
    LEAVE_TO,
    PREVIOUS_CHANGE,
    NEXT_CHANGE,
    PICK,
    PICK_CHANGE,
    STEP_TIME,
    SHOW_YEAR,
  };
});
