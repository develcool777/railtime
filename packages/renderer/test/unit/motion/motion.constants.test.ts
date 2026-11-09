import { describe, expect, test } from 'vitest';
import { STROKE_ATTRIBUTES, STROKE_VERTEX_FLOATS } from '../../../src/motion/motion.constants';

describe('MotionConstants', () => {
  test('lays each attribute of a vertex after the last, as many numbers as a vertex holds', () => {
    let next = 0;
    const offsets: number[] = [];
    for (const { size, offset } of STROKE_ATTRIBUTES) {
      offsets.push(offset - next);
      next = offset + size;
    }
    expect(offsets).toEqual(offsets.map(() => 0));
    expect(next).toBe(STROKE_VERTEX_FLOATS);
  });
});
