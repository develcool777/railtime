import { describe, expect, test } from 'vitest';
import { toTimestamp } from '../../../src/core/date.utils';
import {
  CLOSE_UP_MAX_ZOOM,
  FOLLOW_MAX_ZOOM,
  MIN_MOVE_MS,
  OVERVIEW_MAX_ZOOM,
  STATION_MIN_ZOOM,
  VIEW_3D_BEARING,
  VIEW_3D_ENTRY_ZOOM,
  VIEW_3D_PITCH,
  VIEW_TILT_MS,
} from '../../../src/playback/camera.constants';
import { CameraDirector } from '../../../src/playback/camera.service';
import { closeUpOf } from '../../../src/playback/camera.utils';
import type { StepAnimation } from '../../../src/steps/animation.service';
import { fakeMap } from '../../support/factories/fakeMap.utils';
import { tinyNetwork } from '../../support/factories/tinyNetwork.utils';
import { playbackOf } from '../../support/playback.utils';

const PADDING = { top: 10, right: 20, bottom: 30, left: 40 };

/**
 * The camera on a stand-in map, and a step of the tiny network about to play.
 *
 * @param date - A date just before the step: 1905 for red opening B–C–D, 1915 for C opening on red.
 * @returns The camera, the map, the step's animation and where each station is.
 */
const stepAfter = (date: string) => {
  const playback = playbackOf(tinyNetwork());
  playback.player.seek(toTimestamp(date));
  playback.player.skip();
  const fake = fakeMap();
  const coordOf = (station: string) => playback.index.coordOf(station);
  return { fake, camera: new CameraDirector(fake.map, PADDING), animation: playback.player.active!.animation, coordOf };
};

describe('CameraDirector', () => {
  test('tilts into 3D, coming down to where the buildings stand, and lies flat facing north again', () => {
    const { fake, camera } = stepAfter('1905-01-01');
    expect(camera.viewMode).toBe('2d');
    camera.setViewMode('3d');
    expect(camera.viewMode).toBe('3d');
    expect(fake.moves[0]).toMatchObject({
      kind: 'ease',
      options: { pitch: VIEW_3D_PITCH, bearing: VIEW_3D_BEARING, zoom: VIEW_3D_ENTRY_ZOOM, duration: VIEW_TILT_MS },
    });
    // Already closer: it stays as close.
    camera.setViewMode('2d');
    fake.view.zoom = 17;
    camera.setViewMode('3d');
    expect(fake.moves[2]?.options.zoom).toBe(17);
    camera.setViewMode('2d');
    expect(fake.moves[3]).toMatchObject({ kind: 'ease', options: { pitch: 0, bearing: 0 } });
    // Asked again for the view it has: nothing.
    camera.setViewMode('2d');
    expect(fake.moves).toHaveLength(4);
  });

  test('in 3D, comes down to a change, turned along it, rather than framing it from above', () => {
    const { fake, camera, animation, coordOf } = stepAfter('1905-01-01');
    camera.setViewMode('3d');
    expect(camera.focusStep(animation, new Set(), coordOf, 200)).toBe(MIN_MOVE_MS);
    const { center, bearing } = closeUpOf(animation.cameraPoints(), 0);
    expect(fake.moves[1]).toMatchObject({ kind: 'ease', options: { center, bearing, pitch: VIEW_3D_PITCH, zoom: CLOSE_UP_MAX_ZOOM, duration: MIN_MOVE_MS } });
    // Overview and free play as on the flat map.
    camera.mode = 'overview';
    camera.focusStep(animation, new Set(['a']), coordOf, 1000);
    expect(fake.moves[2]?.kind).toBe('fit');
    camera.mode = 'free';
    expect(camera.focusStep(animation, new Set(), coordOf, 1000)).toBe(0);
  });

  test('closes in on a stretch, at least as slowly as a calm move, and stays once it frames it', () => {
    const { fake, camera, animation, coordOf } = stepAfter('1905-01-01');
    expect(camera.focusStep(animation, new Set(), coordOf, 200)).toBe(MIN_MOVE_MS);
    expect(fake.moves[0]).toMatchObject({ kind: 'fit', options: { padding: PADDING, maxZoom: FOLLOW_MAX_ZOOM, duration: MIN_MOVE_MS } });
    expect(camera.focusStep(animation, new Set(), coordOf, 1000)).toBe(0);
    expect(fake.moves).toHaveLength(1);
  });

  test('pans to a lone station without diving in, and leaves the camera be where it is already in view', () => {
    const { fake, camera, animation, coordOf } = stepAfter('1915-01-01');
    // From the whole city: in close enough to see it, no closer.
    expect(camera.focusStep(animation, new Set(), coordOf, 1000)).toBe(1000);
    expect(fake.moves[0]?.options.maxZoom).toBe(STATION_MIN_ZOOM);
    // Already close and in view: nothing to do.
    fake.view.zoom = 13;
    expect(camera.focusStep(animation, new Set(), coordOf, 1000)).toBe(0);
    // Close, but under a panel over the map's left: a pan.
    fake.view.cover.left = 600;
    expect(camera.focusStep(animation, new Set(), coordOf, 1000)).toBe(1000);
    fake.view.cover.left = 0;
    fake.view.center = coordOf('c');
    expect(camera.focusStep(animation, new Set(), coordOf, 1000)).toBe(0);
    // Close but looking elsewhere: a pan, at the same zoom.
    fake.view.center = [1, 51.5];
    expect(camera.focusStep(animation, new Set(), coordOf, 1000)).toBe(1000);
    expect(fake.moves[2]?.options.maxZoom).toBe(13);
  });

  test('frames a step with the network around it in overview, and leaves the camera to the user when free', () => {
    const { fake, camera, animation, coordOf } = stepAfter('1905-01-01');
    camera.mode = 'overview';
    camera.focusStep(animation, new Set(['a', 'b']), coordOf, 1000);
    expect(fake.moves[0]?.options.maxZoom).toBe(OVERVIEW_MAX_ZOOM);
    // A, west of the step, is in the frame.
    expect((fake.moves[0]!.target as [[number, number]])[0][0]).toBe(coordOf('a')[0]);
    camera.mode = 'free';
    fake.view.zoom = 5;
    expect(camera.focusStep(animation, new Set(), coordOf, 1000)).toBe(0);
    expect(fake.moves).toHaveLength(1);
  });

  test('fits a box whatever the mode, keeping room beside it beyond the panels', () => {
    const { fake, camera } = stepAfter('1905-01-01');
    camera.mode = 'free';
    camera.padding = { top: 0, right: 0, bottom: 0, left: 0 };
    camera.fit(
      [
        [0, 0],
        [1, 1],
      ],
      13,
      800,
      { right: 110 },
    );
    expect(fake.moves).toEqual([
      {
        kind: 'fit',
        target: [
          [0, 0],
          [1, 1],
        ],
        options: { padding: { top: 0, right: 110, bottom: 0, left: 0 }, maxZoom: 13, duration: 800 },
      },
    ]);
  });

  test("fits a box with the room asked for added to the app's own on every side", () => {
    const { fake, camera } = stepAfter('1905-01-01');
    camera.fit(
      [
        [0, 0],
        [1, 1],
      ],
      13,
      800,
      { top: 1, right: 2, bottom: 3, left: 4 },
    );
    expect(fake.moves[0]?.options.padding).toEqual({ top: 11, right: 22, bottom: 33, left: 44 });
  });

  test('frames only the change in follow, not the network already on the map', () => {
    const { fake, camera, animation, coordOf } = stepAfter('1905-01-01');
    camera.focusStep(animation, new Set(['a']), coordOf, 1000);
    // B, the stretch's west end, not A.
    expect((fake.moves[0]!.target as [[number, number]])[0][0]).toBe(coordOf('b')[0]);
  });

  test('leaves the camera be for a step with nothing to frame', () => {
    const { fake, camera } = stepAfter('1905-01-01');
    const nothing = { cameraPoints: () => [] } as unknown as StepAnimation;
    expect(camera.focusStep(nothing, new Set(), () => [0, 0], 1000)).toBe(0);
    expect(fake.moves).toEqual([]);
  });

  test("moves for a lone station inside the app's padding on any side, though no panel covers it", () => {
    const { fake, camera, animation, coordOf } = stepAfter('1915-01-01');
    fake.view.zoom = 13;
    const [longitude, latitude] = coordOf('c');
    const scale = (512 / 360) * 2 ** 13;
    // The view's centre that draws C at a pixel: the stand-in's projection, 1.6× taller in latitude.
    const centreFor = (x: number, y: number): [number, number] => [longitude - (x - 500) / scale, latitude + (y - 300) / (scale * 1.6)];
    // Inside the padding (top 10, right 20, bottom 30, left 40) on each side, then clear of it.
    for (const [x, y] of [
      [30, 300],
      [990, 300],
      [500, 5],
      [500, 585],
    ] as const) {
      fake.view.center = centreFor(x, y);
      expect(camera.focusStep(animation, new Set(), coordOf, 1000)).toBe(1000);
    }
    for (const [x, y] of [
      [50, 300],
      [970, 300],
      [500, 20],
      [500, 560],
    ] as const) {
      fake.view.center = centreFor(x, y);
      expect(camera.focusStep(animation, new Set(), coordOf, 1000)).toBe(0);
    }
  });
});

describe('CameraUtils', () => {
  describe('closeUpOf', () => {
    test("looks at a change's middle, turned so it runs up the screen from its first point to its last", () => {
      expect(
        closeUpOf(
          [
            [0, 51],
            [0, 52],
          ],
          0,
        ),
      ).toEqual({ center: [0, 51.5], bearing: 0 });
      expect(
        closeUpOf(
          [
            [0, 52],
            [0, 51],
          ],
          0,
        ).bearing,
      ).toBeCloseTo(180, 9);
      expect(
        closeUpOf(
          [
            [0, 51],
            [1, 51],
          ],
          0,
        ).bearing,
      ).toBeCloseTo(90, 9);
      expect(
        closeUpOf(
          [
            [1, 51],
            [0, 51],
          ],
          0,
        ).bearing,
      ).toBeCloseTo(-90, 9);
      // North-east, a degree of longitude shorter than one of latitude at 51°.
      expect(
        closeUpOf(
          [
            [0, 51],
            [1, 52],
          ],
          0,
        ).bearing,
      ).toBeCloseTo(Math.atan2(Math.cos((51 * Math.PI) / 180), 1) * (180 / Math.PI), 9);
    });

    test('keeps the turn for a lone station, and needs a point', () => {
      expect(closeUpOf([[0.5, 51.5]], 33)).toEqual({ center: [0.5, 51.5], bearing: 33 });
      expect(() => closeUpOf([], 0)).toThrow('a close-up needs a point at least');
    });
  });
});
