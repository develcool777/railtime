import { describe, expect, test } from 'vitest';
import { LAYERS } from '../../../src/layers/ids.constants';
import { atZoom } from '../../../src/layers/style.utils';
import { PALETTES } from '../../../src/layers/theme.constants';
import { TRAIN_STYLE } from '../../../src/layers/trains.constants';
import { SEGMENT_CORNERS, STROKE_VERTEX_FLOATS } from '../../../src/motion/motion.constants';
import { MotionLayer } from '../../../src/motion/motion.service';
import type { Mover } from '../../../src/motion/motion.types';
import { sideHeightsOf } from '../../../src/motion/motion.utils';
import { fakeMap } from '../../support/factories/fakeMap.utils';

/** A mover of three points, two segments, in red, in the second slot. */
const RED: Mover = {
  path: [
    [0, 0],
    [0.1, 0],
    [0.1, 0.1],
  ],
  color: '#ff0000',
  slot: 0.5,
  group: 'red',
};

/** A mover of one segment, in blue. */
const BLUE: Mover = {
  path: [
    [1, 1],
    [1.1, 1],
  ],
  color: '#0000ff',
  slot: 0,
  group: 'blue',
};

describe('MotionLayer', () => {
  /**
   * A motion layer of trains on a stand-in map, installed.
   *
   * @returns The layer and the stand-in.
   */
  const installed = () => {
    const fake = fakeMap();
    const layer = new MotionLayer(fake.map, { trains: TRAIN_STYLE });
    layer.install(['Font']);
    return { fake, layer };
  };

  test('adds one layer that draws itself, and draws nothing before a theme or anything moving', () => {
    const { fake, layer } = installed();
    expect([...fake.custom.keys()]).toEqual([LAYERS.motion]);
    fake.paint();
    layer.applyPalette(PALETTES.dark);
    fake.paint();
    expect(fake.webgl.draws).toEqual([]);
  });

  test('draws its movers as the map next draws: each stroke of their kind over the last, every segment of them', () => {
    const { fake, layer } = installed();
    layer.applyPalette(PALETTES.dark);
    const repaints = fake.repaints();
    layer.show('trains', [RED, BLUE]);
    expect(fake.repaints()).toBe(repaints + 1);
    fake.paint();
    expect(fake.webgl.uploads).toEqual([3 * SEGMENT_CORNERS.length * STROKE_VERTEX_FLOATS]);
    expect(fake.webgl.draws.map(({ first, count, instances }) => [first, count, instances])).toEqual([[0, 18, 3]]);
    expect(fake.webgl.draws[0]?.uniforms.u_owns).toEqual([0, 1, 0]);
    expect(fake.webgl.draws[0]?.uniforms.u_half_widths).toEqual(
      [TRAIN_STYLE.shadowPx, TRAIN_STYLE.casingPx, TRAIN_STYLE.bodyPx].map(pixels => atZoom(pixels, fake.view.zoom) / 2),
    );
  });

  test('stands them up in 3D, each drawn whole, and lays them down again', () => {
    const { fake, layer } = installed();
    layer.applyPalette(PALETTES.dark);
    layer.show('trains', [RED, BLUE]);
    layer.stand(true);
    fake.paint();
    const rise = atZoom(TRAIN_STYLE.risePx, fake.view.zoom);
    const strokes = sideHeightsOf(rise, atZoom(TRAIN_STYLE.casingPx, fake.view.zoom), 0).length + 2;
    expect(fake.webgl.draws.map(({ count, instances }) => [count, instances])).toEqual([
      [12, strokes],
      [6, strokes],
    ]);
    expect((fake.webgl.draws[0]?.uniforms.u_rises as number[]).at(-1)).toBe(rise);
    layer.stand(false);
    fake.paint();
    expect(fake.webgl.draws.slice(2).map(({ count, instances }) => [count, instances])).toEqual([[18, 3]]);
  });

  test('draws only the groups brought forward, and every one again', () => {
    const { fake, layer } = installed();
    layer.applyPalette(PALETTES.dark);
    layer.show('trains', [RED, BLUE]);
    layer.focus(['blue']);
    fake.paint();
    expect(fake.webgl.uploads).toEqual([SEGMENT_CORNERS.length * STROKE_VERTEX_FLOATS]);
    layer.focus([]);
    fake.paint();
    layer.focus(null);
    fake.paint();
    expect(fake.webgl.uploads).toEqual([SEGMENT_CORNERS.length * STROKE_VERTEX_FLOATS, 3 * SEGMENT_CORNERS.length * STROKE_VERTEX_FLOATS]);
  });

  test('takes a kind off the map once it has none, and asks for no repaint while it stays so', () => {
    const { fake, layer } = installed();
    layer.applyPalette(PALETTES.dark);
    layer.show('trains', [RED]);
    layer.show('trains', []);
    const repaints = fake.repaints();
    layer.show('trains', []);
    expect(fake.repaints()).toBe(repaints);
    fake.paint();
    expect(fake.webgl.draws).toEqual([]);
  });

  test('lets its context go with the map', () => {
    const { fake } = installed();
    fake.map.remove();
    expect(fake.webgl.deleted.toSorted((first, second) => first.localeCompare(second))).toEqual(['buffer', 'program', 'vertexArray']);
  });
});
