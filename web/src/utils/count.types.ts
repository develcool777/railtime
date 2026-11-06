import type { NetworkStats } from '@railtime/network/facts.types';

/** A number as it counts: where it is this frame, and where it was as the shutter opened. */
export type Count = { now: number; before: number };

/** What the year card counts: the network's size, and the year. */
export type CountedSizes = NetworkStats & { year: number };

/** A digit's reel this frame: the digit in its window, the next one on, how far between them it has turned, 0 to 1, how much of a reel wide it is, and how blurred. */
export type Reel = { key: string; mark: null; digit: number; next: number; offset: number; width: number; blur: number };

/** A comma or a point between reels, and how much of its width shows. */
export type ReelMark = { key: string; mark: string; width: number };

/** A number written as reels, how many of its last digits falling after a point. */
export type ReelNumber = { value: number; decimals: number };
