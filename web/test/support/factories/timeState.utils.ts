import type { TimeState } from '@railtime/renderer/transitMap.types';

/**
 * Where the map is: by default today, paused, after the fourth of five changes.
 *
 * @param overrides - What differs from that.
 * @returns The time state.
 */
export const timeAt = (overrides: Partial<TimeState>): TimeState => ({
  time: Date.UTC(2026, 0, 1),
  cursor: 4,
  stepCount: 5,
  todayCursor: 4,
  future: false,
  playing: false,
  stats: { stations: 0, km: 0, lines: 0 },
  ...overrides,
});
