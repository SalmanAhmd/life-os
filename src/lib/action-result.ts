/**
 * Uniform result type for server actions.
 *
 * Server actions never throw to the client for expected failures — they return
 * a discriminated union so the UI can render field errors and toasts without
 * leaking stack traces or database errors.
 */
export type FieldErrors = Record<string, string[]>;

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: FieldErrors };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(error: string, fieldErrors?: FieldErrors): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

/** Maps a ZodError's flattened field errors into our FieldErrors shape. */
export function zodFieldErrors(error: {
  flatten: () => { fieldErrors: Record<string, string[] | undefined> };
}): FieldErrors {
  const flat = error.flatten().fieldErrors;
  const result: FieldErrors = {};
  for (const [key, value] of Object.entries(flat)) {
    if (value && value.length > 0) result[key] = value;
  }
  return result;
}
