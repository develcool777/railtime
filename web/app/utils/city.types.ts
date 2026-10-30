/** The landing page's search and filters. */
export type CityFilter = {
  /** Matched against the city's name, country and networks. */
  query: string;
  /** One country, or every one (empty). */
  country: string;
  /** Cities with a history to play, never built, or both. */
  kind: 'all' | 'history' | 'never-built';
  /** Only cities with plans. */
  withPlans: boolean;
};
