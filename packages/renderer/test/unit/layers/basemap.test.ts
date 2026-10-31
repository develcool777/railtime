import { describe, expect, test } from 'vitest';
import type { LayerSpecification } from 'maplibre-gl';
import { basemapFont, guardMissingNumbers, recolorBasemap } from '../../../src/layers/basemap.utils';
import { FALLBACK_FONT, MISSING_NUMBER, PALETTES } from '../../../src/layers/theme.constants';
import { fakeMap } from '../../support/factories/fakeMap.utils';

/** A few layers of an OpenMapTiles basemap, one of each kind recoloured, and one of the overlay's. */
const STYLE = [
  { id: 'background', type: 'background' },
  { id: 'water', type: 'fill', source: 'tiles', 'source-layer': 'water' },
  { id: 'park', type: 'fill', source: 'tiles', 'source-layer': 'park' },
  { id: 'building', type: 'fill', source: 'tiles', 'source-layer': 'building' },
  { id: 'landuse', type: 'fill', source: 'tiles', 'source-layer': 'landuse' },
  { id: 'building-3d', type: 'fill-extrusion', source: 'tiles', 'source-layer': 'building' },
  { id: 'river', type: 'line', source: 'tiles', 'source-layer': 'waterway' },
  { id: 'border', type: 'line', source: 'tiles', 'source-layer': 'boundary' },
  { id: 'railway', type: 'line', source: 'tiles', 'source-layer': 'transportation' },
  { id: 'road-motorway', type: 'line', source: 'tiles', 'source-layer': 'transportation' },
  { id: 'road-minor', type: 'line', source: 'tiles', 'source-layer': 'transportation', filter: ['<=', ['get', 'rank'], 3] },
  { id: 'poi', type: 'symbol', source: 'tiles', 'source-layer': 'poi' },
  { id: 'place', type: 'symbol', source: 'tiles', 'source-layer': 'place', layout: { 'text-font': ['Basemap Sans'] } },
  { id: 'hillshade', type: 'hillshade', source: 'dem' },
  { id: 'rt-lines', type: 'line', source: 'rt-lines' },
] as LayerSpecification[];

describe('BasemapUtils', () => {
  describe('guardMissingNumbers', () => {
    test('gives a compared value a stand-in that fails the comparison as a missing one does', () => {
      expect(guardMissingNumbers(['<=', ['get', 'ref_length'], 6])).toEqual(['<=', ['coalesce', ['get', 'ref_length'], MISSING_NUMBER], 6]);
      expect(guardMissingNumbers(['>', ['get', 'rank'], 2])).toEqual(['>', ['coalesce', ['get', 'rank'], -MISSING_NUMBER], 2]);
      expect(guardMissingNumbers(['<', 3, ['get', 'rank']])).toEqual(['<', 3, ['coalesce', ['get', 'rank'], -MISSING_NUMBER]]);
    });

    test('guards a comparison inside an "all"', () => {
      const filter = ['all', ['<=', ['get', 'ref_length'], 6], ['match', ['get', 'network'], ['a'], true, false]];
      expect(guardMissingNumbers(filter)).toEqual([
        'all',
        ['<=', ['coalesce', ['get', 'ref_length'], MISSING_NUMBER], 6],
        ['match', ['get', 'network'], ['a'], true, false],
      ]);
    });

    test('hands back the very filter where nothing needs guarding, a guarded one too', () => {
      const plain = ['==', ['get', 'class'], 'motorway'];
      expect(guardMissingNumbers(plain)).toBe(plain);
      const guarded = guardMissingNumbers(['<=', ['get', 'ref_length'], 6]);
      expect(guardMissingNumbers(guarded)).toBe(guarded);
    });
  });

  describe('recolorBasemap', () => {
    test('colours each layer by what it draws, hides points of interest, leaves the overlay be, and guards the filters', () => {
      const fake = fakeMap(STYLE);
      const palette = PALETTES.dark;
      recolorBasemap(fake.map, palette, { labels: true });
      const paint = (id: string) => fake.layers.get(id)?.paint;
      expect(paint('background')).toEqual({ 'background-color': palette.background });
      expect(paint('water')?.['fill-color']).toBe(palette.water);
      expect(paint('park')?.['fill-color']).toBe(palette.green);
      expect(paint('building')?.['fill-color']).toBe(palette.building);
      expect(paint('landuse')?.['fill-outline-color']).toBe(palette.landuse);
      expect(paint('building-3d')).toEqual({ 'fill-extrusion-color': palette.building });
      expect(paint('river')?.['line-color']).toBe(palette.water);
      expect(paint('border')?.['line-color']).toBe(palette.boundary);
      expect(paint('railway')?.['line-color']).toBe(palette.rail);
      expect(paint('road-motorway')?.['line-color']).toBe(palette.majorRoad);
      expect(paint('road-minor')?.['line-color']).toBe(palette.road);
      expect(fake.layers.get('road-minor')?.filter).toEqual(['<=', ['coalesce', ['get', 'rank'], MISSING_NUMBER], 3]);
      expect(fake.layers.get('poi')?.layout.visibility).toBe('none');
      expect(paint('place')).toEqual({ 'text-color': palette.basemapText, 'text-halo-color': palette.basemapHalo, 'icon-opacity': 0 });
      expect(paint('hillshade')).toEqual({});
      expect(paint('rt-lines')).toEqual({});
    });

    test('hides every label for the minimap', () => {
      const fake = fakeMap(STYLE);
      recolorBasemap(fake.map, PALETTES.light, { labels: false });
      expect(fake.layers.get('place')?.layout.visibility).toBe('none');
    });
  });

  describe('basemapFont', () => {
    test("takes the basemap's own font, or a fallback where it has no labels", () => {
      expect(basemapFont(fakeMap(STYLE).map)).toEqual(['Basemap Sans']);
      expect(basemapFont(fakeMap().map)).toEqual(FALLBACK_FONT);
    });
  });
});
