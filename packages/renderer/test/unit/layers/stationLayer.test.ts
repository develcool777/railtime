import { describe, expect, test } from 'vitest';
import type { PointFeature, PulseProperties, StationProperties } from '../../../src/layers/features.types';
import { LAYERS, POP_IN_MS, PULSE_MS, SOURCES } from '../../../src/layers/layers.constants';
import { StationLayer } from '../../../src/layers/stationLayer.service';
import type { StationFrame } from '../../../src/layers/stationLayer.types';
import { PALETTES } from '../../../src/layers/theme.constants';
import { fakeMap } from '../../support/factories/fakeMap.utils';

/** Line order: alphabetical, so a dot takes the colour of its alphabetically first line. */
const compareLines = (first: string, second: string) => first.localeCompare(second);

const installed = () => {
  const fake = fakeMap();
  const layer = new StationLayer(
    fake.map,
    station => [station.length, 0],
    station => station.toUpperCase(),
    compareLines,
  );
  layer.install(['Font']);
  layer.applyPalette(PALETTES.light);
  return { fake, layer };
};

const frameOf = (overrides: Partial<StationFrame>): StationFrame => ({
  now: 0,
  stations: new Map(),
  linked: new Set(),
  planned: new Set(),
  highlighted: new Set(),
  fading: new Map(),
  newLabelOpacity: 1,
  instant: false,
  stepPlaying: false,
  ...overrides,
});

const dots = (fake: ReturnType<typeof fakeMap>) => (fake.data.get(SOURCES.stations) as { features: PointFeature<StationProperties>[] }).features;
const pulses = (fake: ReturnType<typeof fakeMap>) => (fake.data.get(SOURCES.pulses) as { features: PointFeature<PulseProperties>[] }).features;

describe('StationLayer', () => {
  test('draws each station with a line: named, coloured by its first line, an interchange if it has more or a transfer', () => {
    const { fake, layer } = installed();
    const stations = new Map([
      ['a', new Map([['red', '#f00']])],
      [
        'bb',
        new Map([
          ['red', '#f00'],
          ['blue', '#00f'],
        ]),
      ],
      ['ccc', new Map([['red', '#f00']])],
      ['gone', new Map()],
    ]);
    layer.update(frameOf({ stations, linked: new Set(['ccc']), planned: new Set(['a']), instant: true }));
    expect(dots(fake).map(dot => [dot.properties.id, dot.properties.name, dot.properties.color, dot.properties.interchange, dot.properties.planned])).toEqual([
      ['a', 'A', '#f00', false, true],
      ['bb', 'BB', '#00f', true, false],
      ['ccc', 'CCC', '#f00', true, false],
    ]);
    expect(dots(fake)[1]?.geometry.coordinates).toEqual([2, 0]);
    // Shown at once: settled, nothing more to draw.
    expect(dots(fake).every(dot => dot.properties.scale === 1 && dot.properties.opacity === 1)).toBe(true);
    expect(layer.animating).toBe(false);
  });

  test('pops a new station in, animating until it has settled', () => {
    const { fake, layer } = installed();
    const stations = new Map([['a', new Map([['red', '#f00']])]]);
    layer.update(frameOf({ stations, now: 1000 }));
    expect(dots(fake)[0]?.properties.scale).toBeCloseTo(0);
    expect(dots(fake)[0]?.properties.opacity).toBe(0);
    expect(layer.animating).toBe(true);
    layer.update(frameOf({ stations, now: 1000 + POP_IN_MS / 2 }));
    expect(dots(fake)[0]?.properties.scale).toBeGreaterThan(1);
    layer.update(frameOf({ stations, now: 1000 + POP_IN_MS }));
    expect(dots(fake)[0]?.properties).toMatchObject({ scale: 1, opacity: 1 });
    expect(layer.animating).toBe(false);
  });

  test("pulses a step's new station once, fades its label with the step, and forgets the pulse once the step is over", () => {
    const { fake, layer } = installed();
    const stations = new Map([['a', new Map([['red', '#f00']])]]);
    const highlighted = new Set(['a']);
    layer.update(frameOf({ stations, highlighted, stepPlaying: true, now: 0, newLabelOpacity: 0.5 }));
    expect(dots(fake)[0]?.properties).toMatchObject({ highlighted: true, labelOpacity: 0 });
    expect(pulses(fake)).toHaveLength(1);
    layer.update(frameOf({ stations, highlighted, stepPlaying: true, now: PULSE_MS / 2, newLabelOpacity: 0.5 }));
    expect(pulses(fake)[0]?.properties).toMatchObject({ color: '#f00', opacity: 0.5 });
    expect(dots(fake)[0]?.properties.labelOpacity).toBe(0.5);
    // Run out, but the step plays on: kept, so it does not pulse again.
    layer.update(frameOf({ stations, highlighted, stepPlaying: true, now: PULSE_MS * 2 }));
    expect(pulses(fake)).toEqual([]);
    expect(layer.animating).toBe(true);
    layer.update(frameOf({ stations, now: PULSE_MS * 3 }));
    expect(layer.animating).toBe(false);
  });

  test('fades a closing station, and pops a station back in that left and returned', () => {
    const { fake, layer } = installed();
    const stations = new Map([['a', new Map([['red', '#f00']])]]);
    layer.update(frameOf({ stations, instant: true }));
    layer.update(frameOf({ stations, fading: new Map([['a', 0.25]]), now: 10 }));
    expect(dots(fake)[0]?.properties.opacity).toBe(0.25);
    layer.update(frameOf({ now: 20 }));
    expect(dots(fake)).toEqual([]);
    layer.update(frameOf({ stations, now: 30 }));
    expect(dots(fake)[0]?.properties.scale).toBeCloseTo(0);
  });

  test('a jump in time forgets running pulses', () => {
    const { fake, layer } = installed();
    const stations = new Map([['a', new Map([['red', '#f00']])]]);
    layer.update(frameOf({ stations, highlighted: new Set(['a']), stepPlaying: true }));
    layer.resetPulses();
    layer.update(frameOf({ stations, instant: true }));
    expect(pulses(fake)).toEqual([]);
  });

  test('rings the selected station, names stations or not, and fades them behind a route', () => {
    const { fake, layer } = installed();
    layer.select('bb');
    expect(fake.data.get(SOURCES.selection)).toMatchObject({ features: [{ geometry: { coordinates: [2, 0] } }] });
    layer.select(null);
    expect(fake.data.get(SOURCES.selection)).toEqual({ type: 'FeatureCollection', features: [] });

    layer.showLabels(false);
    expect(fake.layers.get(LAYERS.labels)?.layout.visibility).toBe('none');
    expect(fake.layers.get(LAYERS.newLabels)?.layout.visibility).toBe('none');

    layer.fade(true);
    expect(fake.layers.get(LAYERS.stations)?.paint['circle-stroke-opacity']).toEqual(['*', 0.25, ['get', 'opacity']]);
    expect(fake.layers.get(LAYERS.labels)?.paint['text-opacity']).toEqual(['*', 0, ['get', 'labelOpacity']]);
    layer.fade(false);
    expect(fake.layers.get(LAYERS.labels)?.paint['text-opacity']).toEqual(['*', 1, ['get', 'labelOpacity']]);
    expect(fake.layers.get(LAYERS.labels)?.paint['text-color']).toBe(PALETTES.light.label);
  });

  test('keeps the labels hidden and the fade for layers installed later, and finds the station under a point', () => {
    const fake = fakeMap();
    const layer = new StationLayer(
      fake.map,
      () => [0, 0],
      station => station,
      compareLines,
    );
    layer.showLabels(false);
    layer.fade(true);
    layer.install(['Font']);
    expect(fake.layers.get(LAYERS.labels)?.layout.visibility).toBe('none');
    expect(fake.layers.get(LAYERS.stations)?.paint['circle-stroke-opacity']).toEqual(['*', 0.25, ['get', 'opacity']]);
    expect(layer.stationAt([0, 0])).toBeNull();
    fake.rendered.push({ properties: { id: 'a' } });
    expect(layer.stationAt([0, 0])).toBe('a');
  });
});
