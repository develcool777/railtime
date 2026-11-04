import type { LineId, Network, PlanId, StationId } from '../format/network.types';

/**
 * Whether a string names one of a network's stations: where a string from outside (an address)
 * becomes a station's id.
 *
 * @param network - The network.
 * @param id - The string.
 * @returns True if it is a station's id there.
 */
export const isStationIn = (network: Network, id: string): id is StationId => Object.hasOwn(network.stations, id);

/**
 * Whether a string names one of a network's lines: where a string from outside becomes a line's id.
 *
 * @param network - The network.
 * @param id - The string.
 * @returns True if it is a line's id there.
 */
export const isLineIn = (network: Network, id: string): id is LineId => Object.hasOwn(network.lines, id);

/**
 * Whether a string names one of a network's plans: where a string from outside becomes a plan's id.
 *
 * @param network - The network.
 * @param id - The string.
 * @returns True if it is a plan's id there.
 */
export const isPlanIn = (network: Network, id: string): id is PlanId => Object.hasOwn(network.plans ?? {}, id);
