/** What a plan would add to its network, for its card. */
export type PlanFacts = {
  /** Its new stations. */
  stations: number;
  /** Its new track, km. */
  km: number;
  /** The lines its sections build on, in the order they first come, with their colours in each theme. */
  lines: { id: string; name: string; color: string; darkColor: string }[];
};
