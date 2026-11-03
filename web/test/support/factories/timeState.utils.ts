import type { TimeState } from '@railtime/renderer/transitMap.types';

/**
 * Where the map is: by default today, where it rests, paused, after the fourth change.
 *
 * @param overrides - What differs from that.
 * @returns The time state.
 */
export const timeAt = (overrides: Partial<TimeState>): TimeState => ({
  time: Date.UTC(2026, 0, 1),
  cursor: 4,
  progress: 0,
  atToday: true,
  atRest: true,
  inPlan: false,
  playing: false,
  stats: { stations: 0, km: 0, lines: 0 },
  ...overrides,
});
