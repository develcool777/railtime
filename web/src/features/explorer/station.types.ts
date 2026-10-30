/** A station one stop away, and the lines that run there. */
export type NextStation = {
  id: string;
  name: string;
  lines: { id: string; name: string; color: string }[];
};
