/** The tag a brand carries: declared, never made, so a branded value is its base type at run time. */
declare const brand: unique symbol;

/**
 * A base type told apart by name: a `Brand<string, 'StationId'>` is a string, but no other string
 * is one, nor another brand of string. A value gets its brand where it is checked to be one.
 */
export type Brand<Base, Name extends string> = Base & { readonly [brand]: Name };
