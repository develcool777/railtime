import { describe, expect, test } from 'vitest';
import type { CityBoundary } from '../../../src/format/boundary.types';
import { parseBoundary } from '../../../src/validation/boundary.schema';

/** A square city with a lake in it. */
const square = (): CityBoundary => ({
  name: 'Square',
  source: '© OpenStreetMap contributors, relation 1',
  polygons: [
    [
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
        [0, 0],
      ],
      [
        [0.4, 0.4],
        [0.6, 0.4],
        [0.6, 0.6],
        [0.4, 0.4],
      ],
    ],
  ],
});

/**
 * The problems the validator reports.
 *
 * @param input - A boundary.
 * @returns Each problem's message; none for a valid one.
 */
const problemsOf = (input: unknown): string[] => {
  try {
    parseBoundary(input);
    return [];
  } catch (error) {
    return (error as { issues: { message: string }[] }).issues.map(issue => issue.message);
  }
};

describe('BoundarySchema', () => {
  test('accepts an outline of closed rings, a hole among them', () => {
    expect(parseBoundary(square())).toEqual(square());
  });

  test('refuses an open ring, one of two points, a polygon of no ring, and an outline unnamed or uncredited', () => {
    const open = square();
    open.polygons[0]![0]!.pop();
    expect(problemsOf(open)).toEqual(['expected a closed ring: its last point its first']);
    expect(
      problemsOf({
        name: '',
        source: '',
        polygons: [
          [
            [
              [0, 0],
              [0, 0],
            ],
          ],
          [],
        ],
      }),
    ).toEqual([
      'Too small: expected string to have >=1 characters',
      'Too small: expected string to have >=1 characters',
      'Too small: expected array to have >=4 items',
      'Too small: expected array to have >=1 items',
    ]);
  });
});
