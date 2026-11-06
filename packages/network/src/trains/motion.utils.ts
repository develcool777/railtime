import type { TrainProfile } from './trains.types';

/** A ride from one stop to the next, in km and seconds: up to its peak, on at it, and down again. */
type Ride = { rate: number; peak: number; rampSeconds: number; rampKm: number; seconds: number };

/**
 * How a train rides a stretch: pulling away at its rate, holding its top speed if it reaches it, and
 * braking at the same rate to stand at the far end. Stops close together, it brakes before it reaches it.
 *
 * @param profile - How it runs.
 * @param km - How long the stretch is.
 * @returns The ride.
 */
const rideOf = ({ topKmh, rateMetresPerSecondSquared }: TrainProfile, km: number): Ride => {
  const rate = rateMetresPerSecondSquared / 1000;
  const peak = Math.min(topKmh / 3600, Math.sqrt(rate * km));
  const rampSeconds = peak / rate;
  const rampKm = (peak * peak) / (2 * rate);
  return { rate, peak, rampSeconds, rampKm, seconds: 2 * rampSeconds + (km - 2 * rampKm) / peak };
};

/**
 * How long a ride takes: none, over no track.
 *
 * @param profile - How the train runs.
 * @param km - How long the stretch is.
 * @returns How long, seconds.
 */
export const rideSeconds = (profile: TrainProfile, km: number): number => (km > 0 ? rideOf(profile, km).seconds : 0);

/**
 * How far along a ride a train is, a time into it.
 *
 * @param profile - How the train runs.
 * @param km - How long the stretch is.
 * @param into - How long into the ride.
 * @returns How far along it, km.
 */
export const rideKmAt = (profile: TrainProfile, km: number, into: number): number => {
  const { rate, peak, rampSeconds, rampKm, seconds } = rideOf(profile, km);
  if (into < rampSeconds) return (rate * into * into) / 2;
  if (into < seconds - rampSeconds) return rampKm + peak * (into - rampSeconds);
  return km - (rate * (seconds - into) ** 2) / 2;
};

/**
 * How long a ride takes to reach a point on it.
 *
 * @param profile - How the train runs.
 * @param km - How long the stretch is.
 * @param along - How far along it the point is.
 * @returns How long into the ride, seconds.
 */
export const rideSecondsTo = (profile: TrainProfile, km: number, along: number): number => {
  const { rate, peak, rampSeconds, rampKm, seconds } = rideOf(profile, km);
  if (along < rampKm) return Math.sqrt((2 * along) / rate);
  if (along < km - rampKm) return rampSeconds + (along - rampKm) / peak;
  return seconds - Math.sqrt((2 * (km - along)) / rate);
};
