/** The colours of one theme, for the basemap and the overlay. */
export type Palette = {
  background: string;
  water: string;
  green: string;
  landuse: string;
  building: string;
  road: string;
  majorRoad: string;
  rail: string;
  boundary: string;
  /** Basemap labels. */
  basemapText: string;
  basemapHalo: string;
  /** Station labels. */
  label: string;
  labelHalo: string;
  /** Opacity of the blurred glow under every line. */
  glowOpacity: number;
  /** Interchange dot outline. */
  interchangeRing: string;
  /** Minimap viewport box. */
  viewport: string;
};
