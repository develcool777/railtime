/**
 * A change's title inside its line's own view, where the line's name goes without saying:
 * "Red line extended" reads "Extended", "Red line: section closes" reads "Section closes". A title
 * that does not start with the line's name (a station opening on it) stays as it is.
 *
 * @param title - The change's title, as the timeline gives it.
 * @param lineName - The line's name, with or without " line" after it in the title.
 * @returns The title without the line's name, its first letter capital.
 */
export const titleInLine = (title: string, lineName: string): string => {
  const escaped = lineName.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
  const rest = title.replace(new RegExp(`^${escaped}(?: line)?:? `), '');
  return rest === title ? title : rest.charAt(0).toUpperCase() + rest.slice(1);
};
