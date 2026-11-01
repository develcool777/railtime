/** A button of the map's tools: an icon, or a word where no icon says it (2D, 3D). */
export type MapTool = {
  /** What it does, its tooltip and its name for a screen reader. */
  label: string;
  icon?: string;
  /** Written in place of an icon. */
  text?: string;
  /** Its key, shown in the tooltip. */
  kbds?: string[];
  /** For a switch: whether it is on. */
  pressed?: boolean;
  run: () => void;
};
