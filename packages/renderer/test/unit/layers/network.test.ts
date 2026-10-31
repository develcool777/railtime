import { describe, expect, test } from 'vitest';
import { LAYERS, SOURCES, UNFOCUSED_OPACITY } from '../../../src/layers/ids.constants';
import { NetworkLayer } from '../../../src/layers/network.service';
import { buildNetworkSnapshot } from '../../../src/layers/snapshot.utils';
import { PALETTES } from '../../../src/layers/theme.constants';
import { toTimestamp } from '@railtime/core/date.utils';
import { fakeMap } from '../../support/factories/fakeMap.utils';
import { tinyNetwork } from '@railtime/network/testing/tinyNetwork';
import { playbackOf, renderStateOf } from '../../support/playback.utils';

describe('NetworkLayer', () => {
  test("draws a snapshot's lines, ghosts, plans and transfers", () => {
    const fake = fakeMap();
    const layer = new NetworkLayer(fake.map);
    layer.install();
    const playback = playbackOf(tinyNetwork());
    playback.player.seek({ time: toTimestamp('1955-01-01') });
    const snapshot = buildNetworkSnapshot(renderStateOf(playback), false);
    layer.update(snapshot);
    expect(fake.data.get(SOURCES.lines)).toBe(snapshot.lines);
    expect(fake.data.get(SOURCES.ghosts)).toBe(snapshot.ghosts);
    expect(fake.data.get(SOURCES.planned)).toBe(snapshot.planned);
    expect(fake.data.get(SOURCES.transfers)).toBe(snapshot.transfers);
  });

  test("fades the lines out of focus, the glow at the theme's strength, and brings every line back", () => {
    const fake = fakeMap();
    const layer = new NetworkLayer(fake.map);
    layer.install();
    layer.applyPalette(PALETTES.dark);
    expect(fake.layers.get(LAYERS.glow)?.paint['line-opacity']).toBe(PALETTES.dark.glowOpacity);
    expect(fake.layers.get(LAYERS.transferCasing)?.paint['line-color']).toBe(PALETTES.dark.interchangeRing);

    layer.focus(['red']);
    expect(fake.layers.get(LAYERS.lines)?.paint['line-opacity']).toEqual(['case', ['in', ['get', 'line'], ['literal', ['red']]], 1, UNFOCUSED_OPACITY]);
    expect(fake.layers.get(LAYERS.glow)?.paint['line-opacity']).toEqual([
      'case',
      ['in', ['get', 'line'], ['literal', ['red']]],
      PALETTES.dark.glowOpacity,
      PALETTES.dark.glowOpacity * UNFOCUSED_OPACITY,
    ]);
    // A new theme keeps the focus.
    layer.applyPalette(PALETTES.light);
    expect(fake.layers.get(LAYERS.glow)?.paint['line-opacity']).toEqual([
      'case',
      ['in', ['get', 'line'], ['literal', ['red']]],
      PALETTES.light.glowOpacity,
      PALETTES.light.glowOpacity * UNFOCUSED_OPACITY,
    ]);
    layer.focus(null);
    expect(fake.layers.get(LAYERS.lines)?.paint['line-opacity']).toBe(1);
  });
});
