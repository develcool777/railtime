import { expression, latest } from '@maplibre/maplibre-gl-style-spec';
import { describe, expect, test } from 'vitest';
import type { PointFeature, PulseLook, PulseProperties, StationLook, StationProperties } from '../../../src/layers/snapshot.types';
import { LAYERS, POP_IN_MS, PULSE_MS, SOURCES } from '../../../src/layers/ids.constants';
import { StationLayer } from '../../../src/layers/stations.service';
import type { StationFrame } from '../../../src/layers/stations.types';
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
  renamed: new Map(),
  newLabelOpacity: 1,
  instant: false,
  stepPlaying: false,
  ...overrides,
});

/**
 * The features a source holds, each with how it looks: its properties and its feature state, as MapLibre draws it.
 *
 * @param fake - The stand-in map.
 * @param source - The source.
 * @returns The features.
 */
const drawnIn = <Properties extends { id: string }, Look>(fake: ReturnType<typeof fakeMap>, source: string): PointFeature<Properties & Look>[] =>
  (fake.data.get(source) as { features: PointFeature<Properties>[] }).features.map(feature => ({
    ...feature,
    properties: { ...feature.properties, ...(fake.states.get(`${source}|${feature.properties.id}`) as Look) },
  }));
const dots = (fake: ReturnType<typeof fakeMap>) => drawnIn<StationProperties, StationLook>(fake, SOURCES.stations);
const pulses = (fake: ReturnType<typeof fakeMap>) => drawnIn<PulseProperties, PulseLook>(fake, SOURCES.pulses);

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

  test('labels a renamed station with the name it had, and a closing one closed, its name up while its dot goes and a ring closing in', () => {
    const { fake, layer } = installed();
    const stations = new Map([
      ['a', new Map([['red', '#f00']])],
      ['bb', new Map([['red', '#f00']])],
    ]);
    layer.update(frameOf({ stations, instant: true }));
    const step = { stations, highlighted: new Set(['a']), renamed: new Map([['a', 'Old A']]), fading: new Map([['bb', 0]]), stepPlaying: true };
    layer.update(frameOf({ ...step, now: 0 }));
    layer.update(frameOf({ ...step, now: PULSE_MS / 4 }));
    const [renamed, closing] = dots(fake);
    expect(renamed?.properties).toMatchObject({ former: 'Old A', closing: false, highlighted: true });
    expect(closing?.properties).toMatchObject({ former: '', closing: true, opacity: 0, labelOpacity: 1 });
    // The new station's ring grows; the closing one's shrinks.
    const radii = pulses(fake).map(pulse => pulse.properties.radius);
    expect(radii).toHaveLength(2);
    expect(radii[0]).toBeLessThan(radii[1]!);
    // Both labelled at any zoom, the rest only when close.
    expect(fake.layers.get(LAYERS.newLabels)?.filter).toEqual(['any', ['get', 'highlighted'], ['get', 'closing']]);
  });

  test('notes under a label what the step does to its station: renamed, closed, opened, or planned', () => {
    const { fake } = installed();
    const field = fake.layers.get(LAYERS.newLabels)?.layout['text-field'];
    // Read as MapLibre reads it, by the spec's own entry for a label's text, whose JSON is typed loosely.
    const parsed = expression.createExpression(field, latest.layout_symbol['text-field'] as never);
    if (parsed.result !== 'success') throw new Error('the label is not an expression MapLibre reads');
    const label = (properties: Partial<StationProperties>) =>
      String(
        parsed.value.evaluate({ zoom: 14 }, {
          type: 1,
          properties: { name: 'A', former: '', closing: false, highlighted: false, planned: false, ...properties },
        } as never),
      );
    expect(label({ highlighted: true, former: 'Old A' })).toBe('A\nformerly Old A');
    expect(label({ closing: true })).toBe('A\nclosed');
    expect(label({ highlighted: true })).toBe('A\nopened');
    expect(label({ highlighted: true, planned: true })).toBe('A\nplanned');
    expect(label({})).toBe('A');
  });

  test('sends MapLibre nothing for a frame whose stations look as the last: a growing line changes none most frames', () => {
    const { fake, layer } = installed();
    const stations = new Map([['a', new Map([['red', '#f00']])]]);
    layer.update(frameOf({ stations, instant: true, stepPlaying: true, now: 0 }));
    const sends = fake.sends.get(SOURCES.stations);
    layer.update(frameOf({ stations, stepPlaying: true, now: 16 }));
    layer.update(frameOf({ stations, stepPlaying: true, now: 32 }));
    expect(fake.sends.get(SOURCES.stations)).toBe(sends);
    // A station reached: sent.
    layer.update(frameOf({ stations: new Map([...stations, ['bb', new Map([['red', '#f00']])]]), stepPlaying: true, now: 48 }));
    expect(fake.sends.get(SOURCES.stations)).toBe(sends! + 1);
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
    expect(fake.layers.get(LAYERS.stations)?.paint['circle-stroke-opacity']).toEqual(['*', 0.25, ['coalesce', ['feature-state', 'opacity'], 1]]);
    expect(fake.layers.get(LAYERS.labels)?.paint['text-opacity']).toEqual(['*', 0, ['coalesce', ['feature-state', 'labelOpacity'], 1]]);
    layer.fade(false);
    expect(fake.layers.get(LAYERS.labels)?.paint['text-opacity']).toEqual(['*', 1, ['coalesce', ['feature-state', 'labelOpacity'], 1]]);
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
    expect(fake.layers.get(LAYERS.stations)?.paint['circle-stroke-opacity']).toEqual(['*', 0.25, ['coalesce', ['feature-state', 'opacity'], 1]]);
    expect(layer.stationAt([0, 0])).toBeNull();
    fake.rendered.push({ properties: { id: 'a' } });
    expect(layer.stationAt([0, 0])).toBe('a');
  });
});
