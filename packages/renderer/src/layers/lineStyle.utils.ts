import type { TrackSegment } from '../network/index.types';
import type { RenderState, ResolvedLine, SideBySide } from './lineStyle.types';

/**
 * A colour part way between two colours.
 *
 * @param from - `#rrggbb` at fraction 0.
 * @param to - `#rrggbb` at fraction 1.
 * @param fraction - How far, 0..1.
 * @returns The blended `#rrggbb`.
 */
const mixColors = (from: string, to: string, fraction: number): string => {
  const channels = (hex: string) => [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16));
  const fromChannels = channels(from);
  const toChannels = channels(to);
  return `#${fromChannels
    .map((value, channel) =>
      Math.round(value + ((toChannels[channel] ?? value) - value) * fraction)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
};

/**
 * What a line is drawn as in this frame, and in which colour (blending while its identity changes).
 *
 * @param state - The frame's render state.
 * @param line - The line id.
 * @returns The line as drawn.
 */
export const resolveLine = (state: RenderState, line: string): ResolvedLine => {
  const identity = state.timeline.identityOf(line, state.cursor, state.identityProgress !== null);
  const color = identity.previousId
    ? mixColors(state.baseColor(identity.previousId), state.baseColor(identity.id), state.identityProgress ?? 1)
    : state.baseColor(identity.id);
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
export const offsetFor = (sideBySide: SideBySide, segment: TrackSegment, lineId: string): number => {
  const lines = sideBySide.get(segment.index);
  return lines ? (lines.indexOf(lineId) - (lines.length - 1) / 2) * segment.travel : 0;
};
