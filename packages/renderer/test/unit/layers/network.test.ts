import { toTimestamp } from '@railtime/core/date.utils';
import { tinyNetwork } from '@railtime/network/testing/tinyNetwork';
import { lineId } from '@railtime/schema/testing/ids';
import { describe, expect, test } from 'vitest';
import { BOLD_PLANNED_DASHES, LAYERS, PLANNED_DASHES, SOURCES, UNFOCUSED_OPACITY } from '../../../src/layers/ids.constants';
import { ActiveStepLayer, NetworkLayer } from '../../../src/layers/network.service';
import { buildNetworkSnapshot, lineFeature } from '../../../src/layers/snapshot.utils';
import { byZoom, highlightedOpacity, highlightedWidth } from '../../../src/layers/style.utils';
import { PALETTES } from '../../../src/layers/theme.constants';
import { emptyDrawing } from '../../../src/steps/animation.utils';
import { fakeMap } from '../../support/factories/fakeMap.utils';
import { playbackOf, renderStateOf } from '../../support/playback.utils';

describe('NetworkLayer', () => {
  test("draws a snapshot's lines, ghosts, plans and transfers", () => {
    const fake = fakeMap();
    const layer = new NetworkLayer(fake.map);
    layer.install();
    const playback = playbackOf(tinyNetwork());
    playback.player.seek(playback.facts.playheads.on(toTimestamp('1955-01-01')));
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

    layer.focus([lineId('red')]);
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

  test('draws planned track bold, still broken, and back as usual, keeping lines out of focus faded', () => {
    const fake = fakeMap();
    const layer = new NetworkLayer(fake.map);
    layer.install();
    const usual = fake.layers.get(LAYERS.planned)?.paint['line-width'];
    layer.boldPlans(true);
    expect(fake.layers.get(LAYERS.planned)?.paint['line-width']).not.toEqual(usual);
    expect(fake.layers.get(LAYERS.planned)?.paint['line-dasharray']).toEqual(BOLD_PLANNED_DASHES);
    expect(fake.layers.get(LAYERS.planned)?.paint['line-opacity']).toBe(1);
    layer.focus([lineId('red')]);
    expect(fake.layers.get(LAYERS.planned)?.paint['line-opacity']).toEqual(['case', ['in', ['get', 'line'], ['literal', ['red']]], 1, UNFOCUSED_OPACITY]);
    layer.focus(null);
    layer.boldPlans(false);
    expect(fake.layers.get(LAYERS.planned)?.paint['line-width']).toEqual(usual);
    expect(fake.layers.get(LAYERS.planned)?.paint['line-dasharray']).toEqual(PLANNED_DASHES);
    expect(fake.layers.get(LAYERS.planned)?.paint['line-opacity']).toBeCloseTo(0.85);
  });
});

describe('ActiveStepLayer', () => {
  test('sends each source only when what it holds changes: the line as it grows, never a frame the same, and clears it once between steps', () => {
    const fake = fakeMap();
    const layer = new ActiveStepLayer(fake.map);
    layer.install();
    layer.applyPalette(PALETTES.dark);
    expect(fake.layers.get(LAYERS.activeGlow)?.paint['line-opacity']).toBe(PALETTES.dark.glowOpacity);

    // Nothing playing: nothing to send.
    layer.update(emptyDrawing());
    expect(fake.sends.get(SOURCES.active)).toBeUndefined();

    const drawing = emptyDrawing();
    drawing.lines.features.push(
      lineFeature(
        [
          [0, 0],
          [1, 0],
        ],
        '#ff0000',
        0,
        1,
        lineId('red'),
      ),
    );
    layer.update(drawing);
    layer.update(drawing);
    expect(fake.sends.get(SOURCES.active)).toBe(1);
    expect(fake.data.get(SOURCES.active)).toBe(drawing.lines);
    // Its head and links held nothing, and still do: never sent.
    expect([fake.sends.get(SOURCES.growing), fake.sends.get(SOURCES.activeTransfers)]).toEqual([undefined, undefined]);
    // Grown: sent again.
    drawing.lines.features[0]!.geometry.coordinates.push([2, 0]);
    layer.update(drawing);
    expect(fake.sends.get(SOURCES.active)).toBe(2);

    // The step ends: one empty frame clears the map, the rest are skipped.
    for (let frame = 0; frame < 5; frame++) layer.update(emptyDrawing());
    expect(fake.sends.get(SOURCES.active)).toBe(3);
    expect(fake.data.get(SOURCES.active)).toEqual({ type: 'FeatureCollection', features: [] });
  });

  test("widens new built track as it stands out, but keeps a plan's at its width, its dashes the same, standing out by its opacity", () => {
    const fake = fakeMap();
    const layer = new ActiveStepLayer(fake.map);
    layer.install();
    const drawing = emptyDrawing();
    drawing.highlight = 0.5;
    layer.update(drawing);
    for (const planned of [LAYERS.activePlanned, LAYERS.growingPlanned]) {
      expect(fake.layers.get(planned)?.paint['line-width']).toEqual(byZoom(2.2, 5.5));
      expect(fake.layers.get(planned)?.paint['line-opacity']).toEqual(highlightedOpacity(0.85, 0.5));
    }
    expect(fake.layers.get(LAYERS.activeLines)?.paint['line-width']).toEqual(highlightedWidth(2.2, 5.5, 0.5));
  });
});
