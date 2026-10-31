import { z } from 'zod';
import type { CityBoundary } from '../format/boundary.types';

const lngLat = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);

/** A closed ring: three corners at least, its last point its first. */
const ring = z
  .array(lngLat)
  .min(4)
  .refine(points => points[0]?.[0] === points.at(-1)?.[0] && points[0]?.[1] === points.at(-1)?.[1], 'expected a closed ring: its last point its first');

const boundarySchema = z.object({
  name: z.string().min(1),
  source: z.string().min(1),
  polygons: z.array(z.array(ring).min(1)).min(1),
});

/**
 * Validates a city's outline.
 *
 * @param input - A parsed boundary JSON.
 * @returns The outline, typed.
 * @throws {z.ZodError} With every problem listed.
 */
export const parseBoundary = (input: unknown): CityBoundary => boundarySchema.parse(input);
