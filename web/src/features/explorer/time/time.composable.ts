import type { CameraMode } from '@railtime/renderer/transitMap.types';
import { computed, ref, watch } from 'vue';

import { DEFAULT_SPEED } from '~/features/explorer/time/time.constants';
import type { ExplorerTime, ExplorerTimeInput } from '~/features/explorer/time/time.composable.types';
import { isAtRest, yearAway } from '~/features/explorer/time/time.utils';
import type { TimelineTarget } from '~/features/explorer/time/timeline.types';

/**
 * The time control: at rest it shows the network as it is, the timeline picks a date, the player
 * plays the history (with a plan, its future). A date away from rest opens the timeline, so the way
 * back is in sight; playback reaching its end leaves the timeline open, at today.
 *
 * @param input - The map, the time control's mode, the plan, and the panel's part in playback.
 * @returns The time control's state and what changes it.
 */
export const useExplorerTime = (input: ExplorerTimeInput): ExplorerTime => {
  const { binding, timeMode, plan, planOnly, currentChange, onPlay } = input;
  const { map, time } = binding;

  const speed = ref(DEFAULT_SPEED);
  const camera = ref<CameraMode>('follow');
  const range = computed(() => map.value?.range ?? { start: 0, end: Date.now(), today: Date.now() });

  // A link's date, or a change picked in the panel, takes the map away from rest.
  watch(
    () => isAtRest(time.value, plan !== undefined),
    rest => {
      if (!rest && timeMode.value === 'rest') timeMode.value = 'timeline';
    },
  );
  watch(map, transitMap => {
    transitMap?.on('end', () => {
      if (timeMode.value === 'playing') timeMode.value = 'timeline';
    });
  });

  const showFuture = () => {
    if (plan) map.value?.showFuture();
    else map.value?.setDate(range.value.end);
  };
  const showToday = () => map.value?.setDate(range.value.today);

  const playHistory = () => {
    onPlay();
    timeMode.value = 'playing';
    map.value?.setSpeed(speed.value);
    map.value?.setCameraMode(camera.value);
    map.value?.setDate(plan ? range.value.today : range.value.start);
    map.value?.play();
  };
  const play = () => {
    if (timeMode.value === 'playing') map.value?.play();
    else playHistory();
  };
  const togglePlay = () => {
    if (timeMode.value === 'playing' && time.value?.playing) map.value?.pause();
    else play();
  };
  const exitHistory = () => {
    map.value?.pause();
    timeMode.value = 'timeline';
    map.value?.fitNetwork();
  };

  // A network never built has no years to slide through: its button plays the plan.
  const openTimeline = () => {
    if (planOnly) playHistory();
    else timeMode.value = 'timeline';
  };
  const closeTimeline = () => {
    timeMode.value = 'rest';
    showFuture();
  };
  const toggleTimeline = () => {
    if (timeMode.value === 'rest') openTimeline();
    else if (timeMode.value === 'timeline') closeTimeline();
  };

  const pick = (target: TimelineTarget) => {
    const transitMap = map.value;
    if (!transitMap) return;
    const wasPlaying = timeMode.value === 'playing' && time.value?.playing === true;
    if (target.kind === 'future') showFuture();
    else if (target.kind === 'change') transitMap.showChange(target.index);
    else transitMap.setDate(target.time);
    if (wasPlaying && target.kind !== 'future') transitMap.play();
  };

  const setSpeed = (value: number) => {
    speed.value = value;
    map.value?.setSpeed(value);
  };
  const setCamera = (value: CameraMode) => {
    camera.value = value;
    map.value?.setCameraMode(value);
  };

  const stepTime = (direction: -1 | 1) => {
    const now = time.value;
    if (!now || !map.value || planOnly) return;
    if (timeMode.value !== 'playing') map.value.setDate(yearAway(now.time, direction, range.value));
    else if (direction > 0) map.value.skip();
    else map.value.playFrom(Math.max((currentChange.value ?? 0) - 1, 0));
  };

  return {
    speed,
    camera,
    range,
    openTimeline,
    closeTimeline,
    toggleTimeline,
    play,
    togglePlay,
    exitHistory,
    showFuture,
    showToday,
    pick,
    setSpeed,
    setCamera,
    stepTime,
  };
};
