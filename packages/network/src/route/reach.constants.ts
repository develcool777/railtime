import type { ReachBand } from '../model/facts.types';

/**
 * The bands a reach is coloured in, soonest first: each takes the stations reached within its
 * minutes and after the band before's. Warm as it gets farther, and clear on either theme.
 */
export const REACH_BANDS: ReachBand[] = [
  { upTo: 15, label: 'Under 15 min', color: '#21a179' },
  { upTo: 30, label: '15–30 min', color: '#8fbc3f' },
  { upTo: 45, label: '30–45 min', color: '#e9b22c' },
  { upTo: 60, label: '45–60 min', color: '#ec7a2f' },
  { upTo: null, label: 'Over an hour', color: '#d64550' },
];
