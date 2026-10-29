/** A city's dataset, where it is kept. */
export type Dataset = {
  /** Its country's folder in `cities/` (`united-kingdom`). */
  country: string;
  /** Its own folder, the city's id (`tyne-and-wear`). */
  city: string;
  /** The path of `cities/<country>/<city>/<city>.json`. */
  path: string;
};
