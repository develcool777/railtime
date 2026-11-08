import { describe, expect, test } from 'vitest';
import { STROKE_VERTEX_FLOATS } from '../../../src/motion/motion.constants';
import type { StrokePass } from '../../../src/motion/motion.types';
import { StrokePainter } from '../../../src/motion/painter.service';
import { fakeGl } from '../../support/factories/fakeGl.utils';

/** A stroke in each mover's own colour, and one in a colour of its own, shaded and soft. */
const PASSES: StrokePass[] = [
  { widthPx: 10, blurPx: 0, risePx: 0, color: 'own', shade: [0, 0, 0], shadeAmount: 0, opacity: 1 },
  { widthPx: 4, blurPx: 2, risePx: 6, color: [1, 1, 1], shade: [0, 0, 0], shadeAmount: 0.5, opacity: 0.5 },
];

describe('StrokePainter', () => {
  test('draws each run in its turn, an instance a stroke, in the map’s pixels, its colour its own or each mover’s', () => {
    const context = fakeGl();
    const painter = new StrokePainter(context.context);
    const order = [
      { first: 6, count: 6, middle: [0, 0] as const },
      { first: 0, count: 6, middle: [0, 0] as const },
    ];
    painter.draw({ vertices: new Float32Array(12 * STROKE_VERTEX_FLOATS), order, passes: PASSES, slotPx: 3 }, new Float32Array(16));
    expect(context.uploads).toEqual([12 * STROKE_VERTEX_FLOATS]);
    expect(context.draws.map(({ first, count, instances }) => [first, count, instances])).toEqual([
      [6, 6, 2],
      [0, 6, 2],
    ]);
    const { uniforms } = context.draws[0]!;
    expect([uniforms.u_half_widths, uniforms.u_rises, uniforms.u_blurs, uniforms.u_owns, uniforms.u_opacities, uniforms.u_slot_px]).toEqual([
      [5, 2],
      [0, 6],
      [0, 2],
      [1, 0],
      [1, 0.5],
      3,
    ]);
    expect(uniforms.u_colors).toEqual([0, 0, 0, 1, 1, 1]);
    expect(uniforms.u_shade_amounts).toEqual([0, 0.5]);
  });

  test('draws nothing with nothing to draw', () => {
    const context = fakeGl();
    new StrokePainter(context.context).draw({ vertices: new Float32Array(0), order: [], passes: PASSES, slotPx: 3 }, new Float32Array(16));
    expect(context.uploads).toEqual([]);
    expect(context.draws).toEqual([]);
  });

  test('says so when a shader does not compile', () => {
    const context = fakeGl();
    context.failNextCompile();
    expect(() => new StrokePainter(context.context)).toThrow('A stroke shader does not compile: refused');
  });
});
