import type { CityBoundary } from '@railtime/schema/boundary.types';
import type { LngLat } from '@railtime/schema/network.types';
import {
  KM_PER_DEGREE_LATITUDE,
  KM_PER_DEGREE_LONGITUDE_AT_EQUATOR as KM_PER_DEGREE_LONGITUDE_AT_EQUATOR,
  RADIANS_PER_DEGREE as RADIANS_PER_DEGREE,
} from '../core/geometry.constants';
import { boundsOf, latitudeOf, mercatorY } from '../core/geometry.utils';
import { MAX_CELLS, MIN_CELL_KM } from './layer.constants';
import type { GridCorners } from './grid.types';

/**
 * A city cut into cells, as the map draws it: columns even in longitude, rows even on the map, the
 * first row the northernmost. Each cell knows whether the city's outline holds it and how big it is;
 * the grid answers how far each is from the nearest of some points. Pure: it draws nothing.
 */
export class CoverageGrid {
  /** Cells across. */
  public readonly columns: number;
  /** Cells down. */
  public readonly rows: number;
  /** Where the grid's image lies: top left, top right, bottom right, bottom left. */
  public readonly corners: GridCorners;
  /** The city's area: its cells', km². */
  public readonly km2: number;
  /** 1 for each cell inside the outline, row by row. */
  public readonly inside: Uint8Array;
  /** Each row's cell area, km². */
  private readonly rowKm2: Float64Array;
  /** Each row's middle latitude. */
  private readonly rowLatitude: Float64Array;
  /** The grid's west edge, degrees. */
  private readonly west: number;
  /** A column's width, degrees. */
  private readonly columnDegrees: number;
  /** The grid's north edge, in Mercator y. */
  private readonly northY: number;
  /** A row's height, in Mercator y. */
  private readonly rowY: number;

  public constructor(boundary: CityBoundary) {
    const [[west, south], [east, north]] = boundsOf(boundary.polygons.flat(2)) ?? [
      [0, 0],
      [0, 0],
    ];
    const middle = (south + north) / 2;
    const widthKm = (east - west) * KM_PER_DEGREE_LONGITUDE_AT_EQUATOR * Math.cos(middle * RADIANS_PER_DEGREE);
    const heightKm = (north - south) * KM_PER_DEGREE_LATITUDE;
    const cellKm = Math.max(MIN_CELL_KM, Math.sqrt((widthKm * heightKm) / MAX_CELLS));
    this.columns = Math.max(1, Math.ceil(widthKm / cellKm));
    this.rows = Math.max(1, Math.ceil(heightKm / cellKm));
    this.west = west;
    this.columnDegrees = (east - west) / this.columns;
    this.northY = mercatorY(north);
    this.rowY = (this.northY - mercatorY(south)) / this.rows;
    this.corners = [
      [west, north],
      [east, north],
      [east, south],
      [west, south],
    ];
    this.rowLatitude = new Float64Array(this.rows);
    this.rowKm2 = new Float64Array(this.rows);
    for (let row = 0; row < this.rows; row++) {
      const top = latitudeOf(this.northY - row * this.rowY);
      const bottom = latitudeOf(this.northY - (row + 1) * this.rowY);
      const latitude = latitudeOf(this.northY - (row + 0.5) * this.rowY);
      this.rowLatitude[row] = latitude;
      this.rowKm2[row] =
        this.columnDegrees * KM_PER_DEGREE_LONGITUDE_AT_EQUATOR * Math.cos(latitude * RADIANS_PER_DEGREE) * (top - bottom) * KM_PER_DEGREE_LATITUDE;
    }
    this.inside = this.fill(boundary);
    let km2 = 0;
    for (let cell = 0; cell < this.inside.length; cell++) if (this.inside[cell]) km2 += this.cellKm2(cell);
    this.km2 = km2;
  }

  /**
   * A cell's area.
   *
   * @param cell - Its position, row by row.
   * @returns Km².
   */
  public cellKm2(cell: number): number {
    // Within bounds: a cell's row is one of the grid's.
    return this.rowKm2[Math.floor(cell / this.columns)]!;
  }

  /**
   * How far each cell inside the outline is from the nearest point, as the crow flies, up to a reach.
   *
   * @param points - The points: stations.
   * @param reachMetres - The farthest worth knowing; a cell farther from every point is `Infinity`.
   * @returns Metres, cell by cell, row by row; `Infinity` outside the outline too.
   */
  public distances(points: LngLat[], reachMetres: number): Float32Array {
    const metres = new Float32Array(this.inside.length).fill(Infinity);
    const reachKm = reachMetres / 1000;
    for (const [longitude, latitude] of points) {
      const kmPerDegree = KM_PER_DEGREE_LONGITUDE_AT_EQUATOR * Math.cos(latitude * RADIANS_PER_DEGREE);
      const firstColumn = Math.max(0, Math.floor((longitude - reachKm / kmPerDegree - this.west) / this.columnDegrees));
      const lastColumn = Math.min(this.columns - 1, Math.floor((longitude + reachKm / kmPerDegree - this.west) / this.columnDegrees));
      const firstRow = Math.max(0, Math.floor((this.northY - mercatorY(latitude + reachKm / KM_PER_DEGREE_LATITUDE)) / this.rowY));
      const lastRow = Math.min(this.rows - 1, Math.floor((this.northY - mercatorY(latitude - reachKm / KM_PER_DEGREE_LATITUDE)) / this.rowY));
      for (let row = firstRow; row <= lastRow; row++) {
        // Within bounds: the row is clamped to the grid's.
        const northKm = (this.rowLatitude[row]! - latitude) * KM_PER_DEGREE_LATITUDE;
        for (let column = firstColumn; column <= lastColumn; column++) {
          const cell = row * this.columns + column;
          if (!this.inside[cell]) continue;
          const eastKm = (this.west + (column + 0.5) * this.columnDegrees - longitude) * kmPerDegree;
          const distance = Math.hypot(eastKm, northKm) * 1000;
          // Within bounds: the cell is in the grid.
          if (distance <= reachMetres && distance < metres[cell]!) metres[cell] = distance;
        }
      }
    }
    return metres;
  }

  /**
   * Marks the cells whose middle the outline holds, row by row: where a row's line crosses the
   * outline's edges, the stretches between the first and second crossing, the third and fourth, and so
   * on are inside, so a hole is left out.
   *
   * @param boundary - The outline.
   * @returns 1 for each cell inside.
   */
  private fill(boundary: CityBoundary): Uint8Array {
    const inside = new Uint8Array(this.rows * this.columns);
    const rings = boundary.polygons.flat();
    for (let row = 0; row < this.rows; row++) {
      // Within bounds: the loop's.
      const latitude = this.rowLatitude[row]!;
      const crossings: number[] = [];
      for (const ring of rings)
        for (const [position, [fromX, fromY]] of ring.slice(0, -1).entries()) {
          // Within bounds: a ring's next point, the last being the first.
          const [toX, toY] = ring[position + 1]!;
          if (fromY > latitude !== toY > latitude) crossings.push(fromX + ((latitude - fromY) * (toX - fromX)) / (toY - fromY));
        }
      crossings.sort((first, second) => first - second);
      for (let pair = 0; pair + 1 < crossings.length; pair += 2) {
        // Within bounds: the pair's two crossings.
        const from = Math.ceil((crossings[pair]! - this.west) / this.columnDegrees - 0.5);
        const to = Math.floor((crossings[pair + 1]! - this.west) / this.columnDegrees - 0.5);
        for (let column = Math.max(0, from); column <= Math.min(this.columns - 1, to); column++) inside[row * this.columns + column] = 1;
      }
    }
    return inside;
  }
}
