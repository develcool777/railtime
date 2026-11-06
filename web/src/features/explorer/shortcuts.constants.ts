import type { Shortcut } from '~/features/explorer/shortcuts.types';

/**
 * The explorer's keys, but for the number keys (a section each) and Esc: what the keys listen for and
 * what the help lists, from the one list.
 */
export const SHORTCUTS: Shortcut[] = [
  { key: '/', kbds: ['/'], label: 'Find a station or line', action: 'search' },
  { key: '?', kbds: ['?'], label: 'What you can do here', action: 'help' },
  { key: '[', kbds: ['['], label: 'Fold or unfold the panel', action: 'panel' },
  { key: 'h', kbds: ['H'], label: 'Back to today, or the plan built', action: 'rest' },
  { key: ' ', kbds: ['space'], label: 'Play or pause the history', action: 'play' },
  { key: 'arrowleft', kbds: ['←'], label: 'A year back; while playing, the change before', action: 'back' },
  { key: 'arrowright', kbds: ['→'], label: 'A year on; while playing, the next change', action: 'forward' },
  { key: 'n', kbds: ['N'], label: 'Show or hide station names', action: 'names' },
  { key: 's', kbds: ['S'], label: 'Show or hide street names', action: 'streets' },
  { key: 't', kbds: ['T'], label: 'Show or hide trains', action: 'trains' },
  { key: 'd', kbds: ['D'], label: 'See in 3D, or flat', action: 'view3d' },
  { key: 'f', kbds: ['F'], label: 'Map only', action: 'mapOnly' },
];
