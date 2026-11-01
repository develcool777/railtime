/**
 * A name as a folder or an address takes it: in lower case, words joined by hyphens.
 *
 * @param name - A name ("United Kingdom").
 * @returns Its slug (`united-kingdom`).
 */
export const slugOf = (name: string): string => name.toLowerCase().trim().split(/\s+/).join('-');
