import { describe, expect, test, vi } from 'vitest';
import { OVERLAY_SOURCE_MAX_ZOOM, SOURCES } from '../../../src/layers/ids.constants';
import { pointFeature } from '../../../src/layers/snapshot.utils';
import { RouteLayer } from '../../../src/overlay/route.service';
import { fakeMap } from '../../support/factories/fakeMap.utils';

/** What a source holds before anything is sent to it. */
const EMPTY = { type: 'FeatureCollection', features: [] };

describe('MapLayer', () => {
  test("adds each of a group's sources as GeoJSON, empty, cut no finer than overlays are", () => {
    const fake = fakeMap();
    const adding = vi.spyOn(fake.map, 'addSource');
    new RouteLayer(fake.map).install(['Font']);
    expect(adding).toHaveBeenCalledWith(SOURCES.route, { type: 'geojson', data: EMPTY, maxzoom: OVERLAY_SOURCE_MAX_ZOOM });
    expect(fake.data.get(SOURCES.routeStops)).toEqual(EMPTY);
  });

  test('sends a source new features in place of what it held', () => {
    const fake = fakeMap();
    const layer = new RouteLayer(fake.map);
    layer.install(['Font']);
    const stop = pointFeature([0, 0], { kind: 'board' as const, color: '#ff0000', name: 'A' });
    layer.update([], [stop]);
    expect(fake.data.get(SOURCES.routeStops)).toEqual({ ...EMPTY, features: [stop] });
    expect(fake.sends.get(SOURCES.routeStops)).toBe(1);
  });

  test('says which source is missing, sent features before it is added', () => {
    expect(() => new RouteLayer(fakeMap().map).update([], [])).toThrow(`source ${SOURCES.route}`);
  });
});
