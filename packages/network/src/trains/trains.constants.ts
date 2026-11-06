import type { Mode } from '@railtime/schema/network.types';
import type { TrainProfile } from './trains.types';

// Where these figures come from. "The manual" is the Transit Capacity and Quality of Service Manual,
// 3rd edition (TCRP Report 165, 2013), chapter 8: https://onlinepubs.trb.org/onlinepubs/tcrp/tcrp_rpt_165ch-08.pdf
// A figure that says "fitted" has no published source behind it: it was chosen so the trains come out
// right, and a city's test holds the result to real times. The trains are an illustration.

/**
 * A metro between the peaks.
 *
 * Published: its stand, in the manual's planning range of 35 to 45 seconds (exhibit 8-53), and its turn,
 * the 175 seconds the manual works out for a terminal (p. 8-62).
 *
 * Fitted: its speed and rate. The manual's are a line's limits, 100 km/h and 1.3 m/s² (exhibit 8-53);
 * these are what a train averages from stop to stop, under them, set so that with the stand they come
 * to real metros' times, which cities' tests hold them to. Fitted too: its headway, and that a line's
 * branches come together no closer than 3 minutes.
 */
const METRO: TrainProfile = { topKmh: 70, rateMetresPerSecondSquared: 1, standSeconds: 40, turnSeconds: 180, headwaySeconds: 300, closestSeconds: 180 };

/**
 * Main-line trains out to the suburbs.
 *
 * Published: its rate, between what suburban fleets are built to, 0.7 m/s² (https://www.modernrailways.com/node/2744)
 * and 1.0 m/s² (https://en.wikipedia.org/wiki/DBAG_Class_481).
 *
 * Fitted: all the rest, with nothing published to check them by: its speed, a train's between stations
 * and far under what it is built for, its stand, its headway, and how close branches come. Its turn is
 * fitted too: timetable planning rules, seen only as quoted second-hand, give 4 to 6 minutes.
 */
const SUBURBAN: TrainProfile = { topKmh: 80, rateMetresPerSecondSquared: 0.8, standSeconds: 40, turnSeconds: 300, headwaySeconds: 900, closestSeconds: 300 };

/**
 * A tram.
 *
 * Published: its stand, in the 15 to 25 seconds the manual gives light rail (p. 8-56).
 *
 * Fitted: all the rest. Its speed is what the street leaves it, far under what it can do, set so that
 * from stops about 450 m apart it averages near what modern tramways are reported to, 16 to 19 km/h
 * (https://threadreaderapp.com/thread/1466475215865716736.html); its rate, its turn, its headway and how
 * close its routes come have nothing published behind them.
 */
const TRAM: TrainProfile = { topKmh: 30, rateMetresPerSecondSquared: 1, standSeconds: 20, turnSeconds: 180, headwaySeconds: 600, closestSeconds: 270 };

/**
 * An urban cable car.
 *
 * Published: its speed, an operator's 14 mph (https://madeby.tfl.gov.uk/2022/07/13/cable-car-facts-and-trivia/).
 *
 * Fitted: all the rest. Cabins run on a rope, close together, without stopping: drawn as a train, one
 * every 10 minutes stands for them.
 */
const CABLE: TrainProfile = { topKmh: 22.5, rateMetresPerSecondSquared: 0.5, standSeconds: 60, turnSeconds: 120, headwaySeconds: 600, closestSeconds: 600 };

/**
 * How each kind of railway runs: the network keeps no timetable, and says only what kind of railway a
 * line is. Each kind says which of its figures are published, and which fitted.
 */
export const TRAIN_PROFILES: Record<Mode, TrainProfile> = {
  metro: METRO,
  'light-metro': METRO,
  tram: TRAM,
  'suburban-rail': SUBURBAN,
  rail: SUBURBAN,
  cable: CABLE,
};
