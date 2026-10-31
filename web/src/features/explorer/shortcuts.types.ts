/** What a key does: the action a button elsewhere on the page does. */
export type ShortcutAction = 'search' | 'help' | 'panel' | 'timeline' | 'play' | 'back' | 'forward' | 'names' | 'view3d' | 'mapOnly';

/** A key, as the keys listen for it and the help shows it. */
export type Shortcut = {
  /** The key, as `defineShortcuts` takes it. */
  key: string;
  /** How the help writes it. */
  kbds: string[];
  /** What it does, as the help says it. */
  label: string;
  action: ShortcutAction;
};
