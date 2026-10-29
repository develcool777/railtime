import type { ExpressionSpecification } from 'maplibre-gl';

/**
 * A value interpolated by zoom between zoom 10 (the whole city) and zoom 14 (a neighbourhood).
 *
 * @param atCityZoom - The value at zoom 10.
 * @param atStreetZoom - The value at zoom 14.
 * @returns A MapLibre expression.
 */
export const byZoom = (atCityZoom: number | ExpressionSpecification, atStreetZoom: number | ExpressionSpecification): ExpressionSpecification => [
  'interpolate',
  ['linear'],
  ['zoom'],
  10,
  atCityZoom,
  14,
  atStreetZoom,
];

/**
 * A line width that widens with the feature's `highlight` property: new track stands out until its highlight fades.
 *
 * @param atCityZoom - The normal width at zoom 10.
 * @param atStreetZoom - The normal width at zoom 14.
 * @returns A MapLibre expression.
 */
export const highlightedWidth = (atCityZoom: number, atStreetZoom: number): ExpressionSpecification =>
  byZoom(['+', atCityZoom, ['*', ['get', 'highlight'], atCityZoom * 0.8]], ['+', atStreetZoom, ['*', ['get', 'highlight'], atStreetZoom * 0.6]]);

/**
 * The offset that puts lines on shared track side by side: the feature's `offset` slot, about one line width apart.
 *
 * @returns A MapLibre expression.
 */
export const sideBySideOffset = (): ExpressionSpecification => byZoom(['*', ['get', 'offset'], 2.4], ['*', ['get', 'offset'], 6]);
