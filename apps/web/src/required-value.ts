/** Require an existing entry at a boundary whose caller promises a complete collection.
 * Unlike a non-null assertion, this also rejects sparse/malformed runtime data before
 * it can enter numerical arithmetic or be rendered as a misleading result.
 */
export function requiredValue<T>(value: T | undefined, context: string): T {
  if (value === undefined) throw new Error(`Missing required value: ${context}`);
  return value;
}

/** Require a present object/field when null denotes absence, for example a DOM ref. */
export function requiredPresent<T>(value: T | null | undefined, context: string): T {
  if (value === null || value === undefined) throw new Error(`Missing required value: ${context}`);
  return value;
}
