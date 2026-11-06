import type { Mode } from '@railtime/schema/network.types';
import type { TrainProfile } from './trains.types';

/**
 * A metro between the peaks. Its speed and rate are what a train averages from stop to stop, under the
 * top speed and first pull a line's trains are built for (100 km/h and 1.3 m/s² in the Transit Capacity
 * and Quality of Service Manual), and its stand is that manual's planning value, 35 to 45 seconds: together
 * they come to a real metro's published times, which a city's test holds them to. Its turn is the manual's
 * terminal time, 175 seconds. Its headway is a line's between the peaks, 3 to 6.5 minutes in the systems checked,
 * and its branches come together no closer than 3: 20 trains an hour, as lines that fork run theirs.
 */
const METRO: TrainProfile = { topKmh: 70, rateMetresPerSecondSquared: 1, standSeconds: 40, turnSeconds: 180, headwaySeconds: 300, closestSeconds: 180 };

/**
 * Main-line trains out to the suburbs: slower to pull away than a metro's, faster between stations
 * further apart, each branch every quarter of an hour, and every 5 minutes where they run together.
 */
const SUBURBAN: TrainProfile = { topKmh: 80, rateMetresPerSecondSquared: 0.8, standSeconds: 40, turnSeconds: 300, headwaySeconds: 900, closestSeconds: 300 };

/**
 * How each kind of railway runs, each from what real ones do: the network keeps no timetable, and says
 * only what kind of railway a line is. A tram's top speed is what the street leaves it, far under what it
 * can do: measured trams average 18 to 20 km/h, standing about 20 seconds, every 7.5 to 15 minutes.
 */
export const TRAIN_PROFILES: Record<Mode, TrainProfile> = {
  metro: METRO,
  'light-metro': METRO,
  tram: { topKmh: 30, rateMetresPerSecondSquared: 1, standSeconds: 20, turnSeconds: 180, headwaySeconds: 600, closestSeconds: 270 },
  'suburban-rail': SUBURBAN,
  rail: SUBURBAN,
  cable: { topKmh: 36, rateMetresPerSecondSquared: 0.5, standSeconds: 60, turnSeconds: 120, headwaySeconds: 600, closestSeconds: 600 },
};
