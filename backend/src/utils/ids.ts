/**
 * Safely converts a Mongoose reference to a string id.
 * Works for both raw ObjectIds and populated documents (where the ref becomes
 * `{ _id, ... }`), which is a common source of "[object Object]" identity bugs.
 */
export const refId = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object' && value !== null && '_id' in (value as Record<string, unknown>)) {
    return String((value as Record<string, unknown>)._id);
  }
  return String(value);
};

/** Same as refId but undefined instead of an empty string. */
export const refIdOrUndefined = (value: unknown): string | undefined => {
  const id = refId(value);
  return id ? id : undefined;
};
