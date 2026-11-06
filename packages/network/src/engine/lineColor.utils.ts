import type { Line } from '@railtime/schema/network.types';
import type { LineColor } from '../facts/facts.types';

/**
 * A line's colour in each theme: its own, and on dark backgrounds its dark one, if it has one.
 *
 * @param line - The line.
 * @returns Its colours.
 */
export const lineColorOf = ({ color, darkColor = color }: Pick<Line, 'color' | 'darkColor'>): LineColor => ({ light: color, dark: darkColor });
