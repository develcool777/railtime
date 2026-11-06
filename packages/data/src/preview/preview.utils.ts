import { NetworkFacts } from '@railtime/network/facts.service';
import type { Theme } from '@railtime/network/facts.types';
import type { StillRequest, StillTrack } from '@railtime/renderer/basemapStill.types';
import type { Network } from '@railtime/schema/network.types';
import { MAX_PREVIEW_ZOOM, PREVIEW_PADDING } from './preview.constants.ts';
import type { PreviewSize } from './preview.types.ts';

/**
 * What a preview draws of a network: its sketch (`NetworkFacts.sketch`), each line in the theme's
 * colour, the network's first line on top, dashed for a network never built.
 *
 * @param network - The city's network.
 * @param theme - The preview's theme.
 * @returns The track by line, bottom first.
 */
export const previewTrackOf = (network: Network, theme: Theme): StillTrack[] =>
  NetworkFacts.create(network)
    .sketch()
    .map(line => ({ color: line.color[theme], paths: line.paths, dashed: line.dashed }));

/**
 * The picture to take of a network: its track, framed to fill the preview.
 *
 * @param network - The city's network.
 * @param theme - The preview's theme.
 * @param size - The preview's size, in CSS pixels.
 * @returns The request, or `null` for a network with no track to show.
 */
export const previewRequestOf = (network: Network, theme: Theme, size: PreviewSize): StillRequest | null => {
  const track = previewTrackOf(network, theme);
  const points = track.flatMap(line => line.paths.flat());
  if (points.length === 0) return null;
  return { points, padding: PREVIEW_PADDING, maxZoom: MAX_PREVIEW_ZOOM, ...size, track };
};

/**
 * Where a city's preview is kept: beside its network, one file per theme.
 *
 * @param networkPath - The path of `cities/<country>/<city>/<city>.json`.
 * @param theme - The preview's theme.
 * @returns The path of `<city>.<theme>.webp` beside it.
 */
export const previewPathOf = (networkPath: string, theme: Theme): string => networkPath.replace(/\.json$/, () => `.${theme}.webp`);

/**
 * Where a city's social card is kept: the picture a link to its page shows, beside its network. JPEG,
 * which every link preview reads.
 *
 * @param networkPath - The path of `cities/<country>/<city>/<city>.json`.
 * @returns The path of `<city>.social.jpg` beside it.
 */
export const socialPathOf = (networkPath: string): string => networkPath.replace(/\.json$/, '.social.jpg');
