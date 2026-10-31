import type { ImageSource, Map as MapLibreMap } from 'maplibre-gl';
import { LAYERS, LINE_LAYOUT, SOURCES } from '../layers/ids.constants';
import { MapLayer } from '../layers/layer.service';
import type { Palette } from '../layers/theme.types';
import type { CoverageDrawing, CoverageImage } from './layer.types';

/** A clear pixel: what the heatmap's source holds until there is coverage to draw. */
const CLEAR_PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

/**
 * Pixels as a picture the map can load, through a canvas: in the browser only.
 *
 * @param image - The pixels.
 * @returns A data URL.
 */
const canvasUrl = (image: CoverageImage): string => {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  canvas.getContext('2d')?.putImageData(new ImageData(new Uint8ClampedArray(image.pixels), image.width, image.height), 0, 0);
  return canvas.toDataURL();
};

/**
 * How much of the city is within walking distance of a station: the city shaded by the distance to the
 * nearest one, under the network, and its outline. Hidden until the Coverage section draws it.
 */
export class CoverageLayer extends MapLayer {
  /** Turns pixels into a picture the map loads. */
  private readonly toUrl: (image: CoverageImage) => string;
  /** What is drawn: kept, so installing draws coverage shown before the basemap loaded. */
  private drawing: CoverageDrawing = null;
  /** The layers are on the map. */
  private installed = false;

  public constructor(map: MapLibreMap, toUrl: (image: CoverageImage) => string = canvasUrl) {
    super(map);
    this.toUrl = toUrl;
  }

  /**
   * Adds the heatmap's picture and the outline, hidden.
   *
   * @param _font - Unused: nothing here is labelled.
   */
  public install(_font: string[]): void {
    this.map.addSource(SOURCES.coverageHeat, {
      type: 'image',
      url: CLEAR_PIXEL,
      // A tiny square, as MapLibre refuses corners that meet; the first drawing moves it to the city.
      coordinates: [
        [0, 0.0001],
        [0.0001, 0.0001],
        [0.0001, 0],
        [0, 0],
      ],
    });
    this.addSource(SOURCES.coverageOutline);
    this.map.addLayer({
      id: LAYERS.coverageHeat,
      type: 'raster',
      source: SOURCES.coverageHeat,
      layout: { visibility: 'none' },
      // Smoothed between cells, so the bands read as a heatmap, not a grid.
      paint: { 'raster-resampling': 'linear', 'raster-fade-duration': 0 },
    });
    this.map.addLayer({
      id: LAYERS.coverageOutline,
      type: 'line',
      source: SOURCES.coverageOutline,
      layout: { ...LINE_LAYOUT, visibility: 'none' },
      paint: { 'line-width': 1.5, 'line-dasharray': [3, 2] },
    });
    this.installed = true;
    this.draw();
  }

  /**
   * Colours the outline as station names are, so it reads on either theme.
   *
   * @param palette - The theme's colours.
   */
  public applyPalette(palette: Palette): void {
    this.map.setPaintProperty(LAYERS.coverageOutline, 'line-color', palette.label);
  }

  /**
   * Draws the coverage, or hides it.
   *
   * @param drawing - The heatmap, where it lies, and the outline; `null` to hide them.
   */
  public update(drawing: CoverageDrawing): void {
    this.drawing = drawing;
    this.draw();
  }

  /** Shows the drawing kept, or hides the layers without one; before they are installed, nothing. */
  private draw(): void {
    const { drawing } = this;
    if (!this.installed) return;
    const visibility = drawing ? 'visible' : 'none';
    for (const layer of [LAYERS.coverageHeat, LAYERS.coverageOutline]) this.map.setLayoutProperty(layer, 'visibility', visibility);
    if (!drawing) return;
    (this.map.getSource(SOURCES.coverageHeat) as ImageSource | undefined)?.updateImage({ url: this.toUrl(drawing.image), coordinates: drawing.corners });
    this.setData(SOURCES.coverageOutline, { type: 'FeatureCollection', features: drawing.outline });
  }
}
