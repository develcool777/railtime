import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test } from 'vitest';
import { standInMap } from '@test/support/factories/transitMap.utils';
import { useMapStore } from '~/features/explorer/map/map.store';

describe('MapStore', () => {
  beforeEach(() => setActivePinia(createPinia()));

  test('takes the map and what it owes credit to, and lets it go', () => {
    const mapStore = useMapStore();
    const { map } = standInMap();
    mapStore.ATTACH(map);
    expect(mapStore.map).toBe(map);
    expect(mapStore.credits).toEqual([{ text: 'Tiles' }]);
    mapStore.DETACH();
    expect(mapStore.map).toBeNull();
  });

  test('sends the map its camera commands, and nothing without one', () => {
    const mapStore = useMapStore();
    mapStore.ZOOM_IN();
    const { map, commands } = standInMap();
    mapStore.ATTACH(map);
    mapStore.ZOOM_IN();
    mapStore.ZOOM_OUT();
    mapStore.FIT_NETWORK();
    expect(commands.map(command => command.name)).toEqual(['zoomIn', 'zoomOut', 'fitNetwork']);
  });

  test('looks where the address opened, then where the map says', () => {
    const mapStore = useMapStore();
    mapStore.OPEN({ center: [30, 50], zoom: 11 });
    expect(mapStore.view).toEqual({ center: [30, 50], zoom: 11 });
    mapStore.SET_VIEW({ center: [31, 50], zoom: 12 });
    expect(mapStore.view).toEqual({ center: [31, 50], zoom: 12 });
  });
});
