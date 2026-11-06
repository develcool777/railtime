import type { TrackSegment } from '@railtime/network/engine.types';
import type { LineId } from '@railtime/schema/network.types';
import type { ExpressionSpecification } from 'maplibre-gl';
import type { RenderState, ResolvedLine, SideBySide } from './style.types';
import { channelsOf } from '../support/drawing.utils';

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
 * A line width that widens with the feature's `highlight` property: new track stands out until its
 * highlight fades. The fade is the layer's, the same for all of its track, set as a paint value each
 * frame, so the track's data is not sent again for it.
 *
 * @param atCityZoom - The normal width at zoom 10.
 * @param atStreetZoom - The normal width at zoom 14.
 * @param fade - How much of the highlight is left, 0..1.
 * @returns A MapLibre expression.
 */
export const highlightedWidth = (atCityZoom: number, atStreetZoom: number, fade = 1): ExpressionSpecification =>
  byZoom(['+', atCityZoom, ['*', ['get', 'highlight'], atCityZoom * 0.8 * fade]], ['+', atStreetZoom, ['*', ['get', 'highlight'], atStreetZoom * 0.6 * fade]]);

/**
 * An opacity that rises with the feature's `highlight` property: how a plan's new track stands out,
 * its width, which its dashes are measured in, left as it is. The fade is the layer's, as for
 * `highlightedWidth`.
 *
 * @param opacity - The normal opacity.
 * @param fade - How much of the highlight is left, 0..1.
 * @returns A MapLibre expression: full opacity at full highlight.
 */
export const highlightedOpacity = (opacity: number, fade = 1): ExpressionSpecification => ['+', opacity, ['*', ['get', 'highlight'], (1 - opacity) * fade]];

/**
 * The offset that puts lines on shared track side by side: the feature's `offset` slot, about one line width apart.
 *
 * @returns A MapLibre expression.
 */
export const sideBySideOffset = (): ExpressionSpecification => byZoom(['*', ['get', 'offset'], 2.4], ['*', ['get', 'offset'], 6]);

/**
 * A colour part way between two colours.
 *
 * @param from - `#rrggbb` at fraction 0.
 * @param to - `#rrggbb` at fraction 1.
 * @param fraction - How far, 0..1.
 * @returns The blended `#rrggbb`.
 */
const mixColors = (from: string, to: string, fraction: number): string => {
  const fromChannels = channelsOf(from);
  const toChannels = channelsOf(to);
  return `#${fromChannels
    .map((value, channel) =>
      Math.round(value + ((toChannels[channel] ?? value) - value) * fraction)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
};

/**
 * Who a line is in this frame: the one rule for what it is drawn as, which its features and the lines
 * in focus both go by.
 *
 * @param state - The frame's render state.
 * @param line - The line id.
 * @returns Its identity, the line it was before while it changes.
 */
const identityIn = (state: RenderState, line: LineId) => state.timeline.identityOf(line, state.cursor, state.base.blend !== null);

/**
 * Lines as this frame draws them: one drawn as another is that line, and two drawn as one are one.
 *
 * @param state - The frame's render state.
 * @param lines - The line ids.
 * @returns The ids their features carry.
 */
export const linesAsDrawn = (state: RenderState, lines: readonly LineId[]): LineId[] => [...new Set(lines.map(line => identityIn(state, line).id))];

/**
 * What a line is drawn as in this frame, and in which colour (blending while its identity changes).
 *
 * @param state - The frame's render state.
 * @param line - The line id.
 * @returns The line as drawn.
 */
export const resolveLine = (state: RenderState, line: LineId): ResolvedLine => {
  const { blend } = state.base;
  const identity = identityIn(state, line);
  const color = identity.previousId ? mixColors(state.baseColor(identity.previousId), state.baseColor(identity.id), blend ?? 1) : state.baseColor(identity.id);
  return { id: identity.id, color };
};

/**
 * Where a line sits across shared track, for a line drawn in the segment's stored A→B order: 0 alone,
 * ±0.5 for two lines, -1/0/+1 for three… Signed by the segment's direction of travel, so a line keeps
 * to the same side of the corridor from one segment to the next.
 *
 * @param sideBySide - The lines on each segment.
 * @param segment - The segment.
 * @param lineId - The (effective) line.
 * @returns The offset slot.
 */
export const offsetFor = (sideBySide: SideBySide, segment: TrackSegment, lineId: LineId): number => {
  const lines = sideBySide.get(segment.index);
  return lines ? (lines.indexOf(lineId) - (lines.length - 1) / 2) * segment.travel : 0;
};
