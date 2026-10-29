import type { CameraMode } from '@railtime/renderer/transitMap.types';

/**
 * The cities with a dataset (`data/<id>/<id>.json`, served at `/data/<id>/<id>.json`), in menu order:
 * grouped by country, in the order the countries come.
 */
export const CITIES = [
  { label: 'London', value: 'london', country: 'United Kingdom' },
  { label: 'Manchester', value: 'manchester', country: 'United Kingdom' },
  { label: 'Tyne and Wear', value: 'tyne-and-wear', country: 'United Kingdom' },
  { label: 'Kyiv', value: 'kyiv', country: 'Ukraine' },
  { label: 'Kharkiv', value: 'kharkiv', country: 'Ukraine' },
  { label: 'Dnipro', value: 'dnipro', country: 'Ukraine' },
  { label: 'Donetsk', value: 'donetsk', country: 'Ukraine' },
  { label: 'Lviv', value: 'lviv', country: 'Ukraine' },
  { label: 'Odesa', value: 'odesa', country: 'Ukraine' },
  { label: 'Zaporizhzhia', value: 'zaporizhzhia', country: 'Ukraine' },
  { label: 'Chernivtsi', value: 'chernivtsi', country: 'Ukraine' },
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
