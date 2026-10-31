import { describe, expect, test } from 'vitest';
import { toTimestamp } from '../../../src/core/date.utils';
import { CameraDirector } from '../../../src/playback/camera.service';
import { fakeMap } from '../../support/factories/fakeMap.utils';
import { tinyNetwork } from '../../support/factories/tinyNetwork.utils';
import { playbackOf } from '../../support/playback.utils';

const PADDING = { top: 10, right: 20, bottom: 30, left: 40 };

/** The camera on a stand-in map, and the step that opens B–C–D on red in 1910, about to play. */
const stepAbout = () => {
  const playback = playbackOf(tinyNetwork());
  playback.player.seek(toTimestamp('1905-01-01'));
  playback.player.skip();
  const fake = fakeMap();
  return { fake, camera: new CameraDirector(fake.map, PADDING), animation: playback.player.active!.animation, playback };
};

describe('CameraDirector', () => {
  test('follows a step closely, frames it with the network around it in overview, and leaves the camera be when free', () => {
    const { fake, camera, animation, playback } = stepAbout();
    const coordOf = (station: string) => playback.index.coordOf(station);
    camera.focusStep(animation, new Set(['a', 'b']), coordOf, 500);
    expect(fake.moves[0]).toMatchObject({ kind: 'fit', options: { padding: PADDING, maxZoom: 13.5, duration: 500 } });
    const [[west], [east]] = fake.moves[0]!.target as [[number, number], [number, number]];

    camera.mode = 'overview';
    camera.focusStep(animation, new Set(['a', 'b']), coordOf, 500);
    expect(fake.moves[1]).toMatchObject({ options: { maxZoom: 12.5 } });
    // A, the station west of the step, is in the frame now.
    expect((fake.moves[1]!.target as [[number, number]])[0][0]).toBeLessThan(west);
    expect((fake.moves[1]!.target as [[number, number], [number, number]])[1][0]).toBe(east);

    camera.mode = 'free';
    camera.focusStep(animation, new Set(), coordOf, 500);
    expect(fake.moves).toHaveLength(2);
  });

  test('fits a box whatever the mode, keeping room beside it beyond the panels', () => {
    const { fake, camera } = stepAbout();
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
});
