import type { CameraMode } from '@railtime/renderer/transitMap.types';
import type { PlanStatus } from '@railtime/schema/network.types';
import type { ChipTone } from './plan.types';

/**
 * The cities with a dataset (`data/<id>/<id>.json`, served at `/data/<id>/<id>.json`), in menu order:
 * grouped by country, in the order the countries come.
 */
export const CITIES = [
  { label: 'London', value: 'london', country: 'United Kingdom' },
  { label: 'Manchester', value: 'manchester', country: 'United Kingdom' },
  { label: 'Glasgow', value: 'glasgow', country: 'United Kingdom' },
  { label: 'Tyne and Wear', value: 'tyne-and-wear', country: 'United Kingdom' },
  { label: 'Leeds', value: 'leeds', country: 'United Kingdom' },
  { label: 'Bristol', value: 'bristol', country: 'United Kingdom' },
  { label: 'Liverpool', value: 'liverpool', country: 'United Kingdom' },
  { label: 'Kyiv', value: 'kyiv', country: 'Ukraine' },
  { label: 'Kharkiv', value: 'kharkiv', country: 'Ukraine' },
  { label: 'Dnipro', value: 'dnipro', country: 'Ukraine' },
  { label: 'Kryvyi Rih', value: 'kryvyi-rih', country: 'Ukraine' },
  { label: 'Donetsk', value: 'donetsk', country: 'Ukraine' },
  { label: 'Lviv', value: 'lviv', country: 'Ukraine' },
  { label: 'Odesa', value: 'odesa', country: 'Ukraine' },
  { label: 'Zaporizhzhia', value: 'zaporizhzhia', country: 'Ukraine' },
  { label: 'Chernivtsi', value: 'chernivtsi', country: 'Ukraine' },
  { label: 'Prague', value: 'prague', country: 'Czechia' },
  { label: 'Budapest', value: 'budapest', country: 'Hungary' },
  { label: 'Riga', value: 'riga', country: 'Latvia' },
  { label: 'Warsaw', value: 'warsaw', country: 'Poland' },
  { label: 'Kraków', value: 'krakow', country: 'Poland' },
  { label: 'Lisbon', value: 'lisbon', country: 'Portugal' },
  { label: 'Bratislava', value: 'bratislava', country: 'Slovakia' },
];

/** Playback speeds offered. */
export const SPEED_OPTIONS = [1, 2, 4, 8].map(speed => ({ label: `${speed}×`, value: speed }));

/** Default playback speed: London's whole history takes about five and a half minutes. */
export const DEFAULT_SPEED = 2;

/** Camera modes offered during playback. */
export const CAMERA_OPTIONS: { label: string; value: CameraMode }[] = [
  { label: 'Follow', value: 'follow' },
  { label: 'Overview', value: 'overview' },
  { label: 'Free', value: 'free' },
];

/** One day, the slider's step. */
export const DAY_MS = 864e5;

/** The share of the timeline a plan's changes take, at its right end. */
export const FUTURE_SHARE = 0.16;

/** How many marks of one year stack on the timeline before they overlap. */
export const MAX_TICK_LEVEL = 3;

/** Years between the labels under the timeline. */
export const TIMELINE_LABEL_YEARS = 25;

/** Changes listed under "Up next" during playback. */
export const UP_NEXT_COUNT = 6;

/** How a plan's card names its status, and the chip's colours. */
export const PLAN_STATUSES: Record<PlanStatus, { label: string; tone: ChipTone }> = {
  'under-construction': { label: 'Under construction', tone: 'amber' },
  planned: { label: 'Planned', tone: 'green' },
  proposed: { label: 'Proposed', tone: 'blue' },
  concept: { label: 'Concept', tone: 'neutral' },
  abandoned: { label: 'Abandoned', tone: 'neutral' },
};
