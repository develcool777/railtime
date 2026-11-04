import type { z } from 'zod';
import type { LineId, Network, NetworkId, PlanId, StationId } from '../../src/format/network.types';
import type { networkShape } from '../../src/validation/shape.schema';

/** A network as its file is written: each id a plain string, as `parseNetwork` reads it. */
export type WrittenNetwork = z.input<typeof networkShape>;

/** A segment as a file writes it. */
export type WrittenSegment = WrittenNetwork['segments'][number];

/** A station as a file writes it. */
export type WrittenStation = WrittenNetwork['stations'][string];

/**
 * A station id a test names, trusted as one: a test's network is made up beside it.
 *
 * @param id - The id.
 * @returns It, as a station's.
 */
export const stationId = (id: string): StationId => id as StationId;

/**
 * A line id a test names, trusted as one.
 *
 * @param id - The id.
 * @returns It, as a line's.
 */
export const lineId = (id: string): LineId => id as LineId;

/**
 * A network id a test names, trusted as one.
 *
 * @param id - The id.
 * @returns It, as a network's.
 */
export const networkId = (id: string): NetworkId => id as NetworkId;

/**
 * A plan id a test names, trusted as one.
 *
 * @param id - The id.
 * @returns It, as a plan's.
 */
export const planId = (id: string): PlanId => id as PlanId;

/**
 * A network a test writes, as its file would be, trusted as read: its ids are what it names them,
 * unchecked, so a test can make one the schema would refuse.
 *
 * @param written - The network.
 * @returns It, its ids typed.
 */
export const asNetwork = (written: WrittenNetwork): Network => written as Network;
