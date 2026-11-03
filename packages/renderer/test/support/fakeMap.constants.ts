import type { LayerSpecification } from 'maplibre-gl';

/** A basemap of one layer, the land, black until a theme colours it: its `background-color` says which theme it is in. */
export const LAND_LAYER = { id: 'land', type: 'background', paint: { 'background-color': '#000000' } } as const satisfies LayerSpecification;
