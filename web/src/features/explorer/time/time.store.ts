import { endOfYear, yearOf } from '@railtime/core/date.utils';
import type { NetworkFacts } from '@railtime/network/facts.service';
import type { Moment, Playhead, StepInfo } from '@railtime/network/facts.types';
import type { TimeState } from '@railtime/renderer/transitMap.types';
import { arrivalTimeOf } from '@railtime/renderer/transitMap.utils';
import { defineStore } from 'pinia';
import { computed, ref, shallowRef } from 'vue';
import { STORE_IDS } from '~/constants/store.constants';
import type { ExplorerUrlState } from '~/features/explorer/address/address.types';
import { linkedMomentOf } from '~/features/explorer/address/address.utils';
import type { PlayerSettings, TimeMode } from '~/features/explorer/explorer.types';
import { useMapStore } from '~/features/explorer/map/map.store';
import { useNetworkStore } from '~/features/explorer/network.store';
import { DEFAULT_PLAYER } from '~/features/explorer/time/time.constants';
import type { TimelineTarget } from '~/features/explorer/time/timeline.types';

/**
 * Time in the explorer: how playback is set, where the history is and the change playing, as the map
 * tells them, and so what the time control shows (the player while the map plays, else the timeline);
 * where the map stands on a network given it (`arrival`, a prop: the map reads it with the network);
 * and every command that moves through time, sent to the map. It reads the network shown and the map.
 */
export const useTimeStore = defineStore(STORE_IDS.EXPLORER_TIME, () => {
  const network = useNetworkStore();
  const mapStore = useMapStore();

  // ---- State
  /** How playback is set: its speed, its camera, the minimap. */
  const player = ref<PlayerSettings>({ ...DEFAULT_PLAYER });
  /** Where the history is, as the map will say on arriving and tells it from then on; `null` with no network open. */
  const time = shallowRef<TimeState | null>(null);
  /** The change playing, as the map tells it. */
  const step = shallowRef<StepInfo | null>(null);
  /** Where the map stands on the network shown as it is given it: the moment asked for, or `null` where it rests. */
  const arrival = shallowRef<Moment | null>(null);
  /** The map played to its end, and has not played since. */
  const playedOut = ref(false);

  // ---- Getters
  /** What the time control shows: the player while the map plays, which only the map knows; else the timeline. */
  const timeMode = computed((): TimeMode => (time.value?.playing ? 'playing' : 'timeline'));
  /** The time control shows the player. */
  const playerShown = computed(() => timeMode.value === 'playing');
  /** Where the history is, as the address names it. */
  const linkedMoment = computed(() => (time.value && network.facts ? linkedMomentOf(time.value, network.facts.playheads) : null));
  /** The year shown; `null` in a plan, or with no network open. */
  const shownYear = computed(() => (!time.value || time.value.inPlan ? null : yearOf(time.value.time)));

  // ---- Actions
  /**
   * A network is shown: where the map stands on it, said with it, and from now where the history is on
   * it, as the map's next frame will tell. A cursor means something only to its own network, so none of
   * the last is ever read against this one, nor the change it was playing.
   *
   * @param moment - The moment; `null` for where the network rests.
   */
  const ARRIVE = (moment: Moment | null) => {
    arrival.value = moment;
    time.value = network.facts && arrivalTimeOf(network.facts, moment);
    step.value = null;
  };
  /**
   * Sets time for a page opening: playback set as the address says, and arrived where in the history
   * it asks for, so all that is read for a moment is there before the map is.
   *
   * @param address - What the address asks for.
   */
  const OPEN = (address: ExplorerUrlState) => {
    player.value = { speed: address.speed, camera: address.camera, minimap: address.minimap };
    playedOut.value = false;
    ARRIVE(address.at ?? null);
  };
  /**
   * Moves the map to a playhead of the network shown.
   *
   * @param where - Picks it from the network's playheads.
   */
  const SEEK = (where: (playheads: NetworkFacts['playheads']) => Playhead) => {
    if (network.facts) mapStore.map?.seek(where(network.facts.playheads));
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
    playedOut.value = false;
    mapStore.map?.play();
  };
  /** The map played to its end. */
  const END_PLAYBACK = () => {
    playedOut.value = true;
  };
  /** Pauses where it is: the timeline, at the date reached. */
  const PAUSE = () => {
    mapStore.map?.pause();
  };
  /** Pauses while the map plays; else plays. */
  const TOGGLE_PLAY = () => {
    if (playerShown.value) PAUSE();
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
    player,
    time,
    step,
    arrival,
    playedOut,
    // Getters
    timeMode,
    playerShown,
    linkedMoment,
    shownYear,
    // Actions
    OPEN,
    ARRIVE,
    SEEK,
    SET_TIME,
    SET_STEP,
    SET_PLAYER,
    PLAY,
    END_PLAYBACK,
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
