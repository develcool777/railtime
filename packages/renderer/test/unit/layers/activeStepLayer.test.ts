import { describe, expect, test } from 'vitest';
import { ActiveStepLayer } from '../../../src/layers/activeStepLayer.service';
import { lineFeature } from '../../../src/layers/features.utils';
import { LAYERS, SOURCES } from '../../../src/layers/layers.constants';
import { PALETTES } from '../../../src/layers/theme.constants';
import { emptyDrawing } from '../../../src/steps/stepAnimation.utils';
import { fakeMap } from '../../support/factories/fakeMap.utils';

describe('ActiveStepLayer', () => {
  test('draws the growing track and its heads, then clears them once and sends nothing more between steps', () => {
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
        'red',
      ),
    );
    layer.update(drawing);
    layer.update(drawing);
    expect(fake.sends.get(SOURCES.active)).toBe(2);
    expect(fake.data.get(SOURCES.active)).toBe(drawing.lines);

    // The step ends: one empty frame clears the map, the rest are skipped.
    for (let frame = 0; frame < 5; frame++) layer.update(emptyDrawing());
    expect(fake.sends.get(SOURCES.active)).toBe(3);
    expect(fake.sends.get(SOURCES.heads)).toBe(3);
    expect(fake.data.get(SOURCES.active)).toEqual({ type: 'FeatureCollection', features: [] });
  });
});
