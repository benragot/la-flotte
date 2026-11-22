/** Garde de type : élimine `undefined` sans cast. */
export function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}
