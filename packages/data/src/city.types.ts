/** A city kept in `cities/<country>/<city>/`, and where its files are. */
export type City = {
  /** Its country's folder in `cities/` (`united-kingdom`). */
  country: string;
  /** Its own folder, the city's id (`tyne-and-wear`). */
  id: string;
  /** `<city>.json`: its network and history, the city's source of truth. */
  networkPath: string;
  /** `<city>.boundary.json`: its outline, which the Coverage section measures within. */
  boundaryPath: string;
};
