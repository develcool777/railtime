import type { OverlayRequest } from '../transitMap.types';

/**
 * What an overlay is of, for the camera: it frames an overlay when this changes (new ends, a new start,
 * coverage opened), and leaves the view be as the date or theme changes it.
 *
 * @param request - The overlay asked for, or `null`.
 * @returns Its subject, or `null` for none.
 */
export const overlaySubjectOf = (request: OverlayRequest | null): string | null => {
  if (!request) return null;
  if (request.kind === 'route') return `route|${request.from}|${request.to}|${request.preference}`;
  if (request.kind === 'reach') return `reach|${request.from}`;
  return 'coverage';
};
