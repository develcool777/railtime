import type { TransitMap } from '@railtime/renderer/transitMap.service';

/** A command a stand-in map was given: its name and what it was given. */
export type MapCommand = { name: string; args: unknown[] };

/** The commands the stores give the map. */
const COMMANDS = ['seek', 'play', 'pause', 'stop', 'skip', 'previousChange', 'stepYear', 'zoomIn', 'zoomOut', 'fitNetwork'] as const;

/**
 * A stand-in for the map, as the stores use it: it owes one credit, and records each command it is
 * given, in order, doing nothing else.
 *
 * @returns The map, and the commands it has been given.
 */
export const standInMap = (): { map: TransitMap; commands: MapCommand[] } => {
  const commands: MapCommand[] = [];
  const record = Object.fromEntries(
    COMMANDS.map(name => [
      name,
      (...args: unknown[]) => {
        commands.push({ name, args });
      },
    ]),
  );
  return { map: { ...record, credits: [{ text: 'Tiles' }] } as unknown as TransitMap, commands };
};
