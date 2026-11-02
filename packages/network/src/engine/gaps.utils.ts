import type { LineGap } from './engine.types';

/**
 * What is left of a run outside a line's gaps: the run cut at each, a piece either side.
 *
 * @param opens - When the run opens, as a timestamp.
 * @param closes - When it closes; `null` for still running.
 * @param gaps - The line's gaps.
 * @returns The pieces, in order, each with its own dates; none if a gap takes all of it.
 */
export const outsideGaps = (opens: number, closes: number | null, gaps: readonly LineGap[]): { opens: number; closes: number | null }[] =>
  [...gaps]
    .sort((first, second) => first.from - second.from)
    .reduce(
      (pieces, gap) =>
        pieces.flatMap(piece => {
          const end = piece.closes ?? Infinity;
          if (gap.until <= piece.opens || gap.from >= end) return [piece];
          return [
            ...(gap.from > piece.opens ? [{ opens: piece.opens, closes: gap.from }] : []),
            ...(gap.until < end ? [{ opens: gap.until, closes: piece.closes }] : []),
          ];
        }),
      [{ opens, closes }],
    );
