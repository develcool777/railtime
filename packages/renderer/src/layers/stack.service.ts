import type { NetworkEngine } from '@railtime/network/engine.service';
import type { LineId } from '@railtime/schema/network.types';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { basemapFont, recolorBasemap, showBasemapLabels } from './basemap.utils';
import { BuildingsLayer } from './buildings.service';
import type { MapLayer } from './layer.service';
import { ActiveStepLayer, NetworkLayer } from './network.service';
import { StationLayer } from './stations.service';
import type { Palette } from './theme.types';
import { TrainLayer } from './trains.service';
import { CoverageLayer } from '../overlay/coverage.service';
import { ReachLayer } from '../overlay/reach.service';
import { RouteLayer } from '../overlay/route.service';

/**
 * The map's layer groups, one of each for the map's whole life, whichever network they draw: made
 * with the map, installed once its style has loaded, in their order, bottom to top. What holds across
 * the groups, a theme and the network as a backdrop, is applied here.
 */
export class MapLayers {
  /** The network already on the map. */
  public readonly network: NetworkLayer;
  /** What the playing step draws. */
  public readonly activeStep: ActiveStepLayer;
  /** Trains running on the lines, when turned on. */
  public readonly trains: TrainLayer;
  /** Stations, labels, pulses and the selection ring. */
  public readonly stations: StationLayer;
  /** A route over the network. */
  public readonly route: RouteLayer;
  /** How far one gets from a station. */
  public readonly reach: ReachLayer;
  /** How much of the city is near a station. */
  public readonly coverage: CoverageLayer;
  /** The basemap's buildings, standing in 3D. */
  private readonly buildings: BuildingsLayer;
  /** The map they are drawn on. */
  private readonly map: MapLibreMap;

  public constructor(map: MapLibreMap, engine: () => NetworkEngine, clock: () => number) {
    this.map = map;
    this.network = new NetworkLayer(map);
    this.activeStep = new ActiveStepLayer(map);
    this.trains = new TrainLayer(map);
    this.route = new RouteLayer(map);
    this.reach = new ReachLayer(map);
    this.coverage = new CoverageLayer(map);
    this.buildings = new BuildingsLayer(map);
    // Asked of the network drawn now: another has its own stations and lines.
    this.stations = new StationLayer(
      map,
      station => engine().index.coordOf(station),
      station => engine().index.stationLabel(station, clock()),
      (first, second) => engine().index.compareLines(first, second),
    );
  }

  /** The style has loaded: adds every group, bottom to top. */
  public install(): void {
    const font = basemapFont(this.map);
    for (const layer of this.stack) layer.install(font);
  }

  /**
   * Colours the basemap and every group for a theme.
   *
   * @param palette - The theme's colours.
   * @param streetLabels - Whether the basemap names its streets and places.
   */
  public applyTheme(palette: Palette, streetLabels: boolean): void {
    recolorBasemap(this.map, palette, { labels: streetLabels });
    for (const layer of this.stack) layer.applyPalette(palette);
  }

  /**
   * Names the basemap's streets and places, or leaves them unnamed.
   *
   * @param shown - Whether to name them.
   */
  public showStreetLabels(shown: boolean): void {
    showBasemapLabels(this.map, shown);
  }

  /**
   * Stands the buildings up, or lays them down.
   *
   * @param shown - Whether they stand.
   */
  public showBuildings(shown: boolean): void {
    this.buildings.show(shown);
  }

  /**
   * Fades the network behind what is drawn over it; else brings forward the lines in focus.
   *
   * @param backdrop - The network is a backdrop: a route or a reach is drawn over it.
   * @param focusedLines - The lines in focus; `null` for every line.
   */
  public applyBackdrop(backdrop: boolean, focusedLines: LineId[] | null): void {
    this.network.focus(backdrop ? [] : focusedLines);
    this.trains.focus(backdrop ? [] : focusedLines);
    this.stations.fade(backdrop);
  }

  /** The groups, bottom to top. */
  private get stack(): MapLayer[] {
    return [this.coverage, this.buildings, this.network, this.activeStep, this.trains, this.stations, this.route, this.reach];
  }
}
