/**
 * A value that must be there: a lookup by an id the network itself supplied. Fails loudly instead of
 * letting `undefined` travel into a drawing.
 *
 * @param value - The looked-up value.
 * @param what - What was looked up, for the error.
 * @returns The value.
 * @throws {Error} If it is missing, which means the network references something it does not have.
 */
export const required = <Value>(value: Value | undefined, what: string): Value => {
  if (value === undefined) throw new Error(`Missing ${what}`);
  return value;
};
