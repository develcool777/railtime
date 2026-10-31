/** One of the panel's sections, as the rail lists them. */
export type Section = 'lines' | 'stations' | 'changes' | 'route' | 'reach' | 'coverage' | 'insights' | 'plans';

/** How high the phone's sheet stands: its tabs only, half the screen, or all of it. */
export type SheetSnap = 'peek' | 'half' | 'full';

/** What the time control shows: the totals at rest, the timeline to pick a date, or the player. */
export type TimeMode = 'rest' | 'timeline' | 'playing';
