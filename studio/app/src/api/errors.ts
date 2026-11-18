/** What went wrong, in broad terms, so a screen can decide what to offer next. */
export type ApiErrorKind =
  | 'offline'    // the studio server did not answer
  | 'not-found'  // the job, film or file is not there
  | 'stale'      // the film changed since these edits were made (409)
  | 'refused'    // the server understood and said no (400): `problems` says why
  | 'failed';    // anything else

/** The one error the client throws. `message` is always a plain sentence, ready to show to a person. */
export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number;
  /** Every problem the server named, in order. Empty when it named none. */
  readonly problems: string[];
  /** With `kind: 'stale'`: when the film on disk last changed. */
  readonly filmModified: number | null;

  constructor(kind: ApiErrorKind, message: string, detail: { status?: number; problems?: string[]; filmModified?: number | null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = detail.status ?? 0;
    this.problems = detail.problems ?? [];
    this.filmModified = detail.filmModified ?? null;
  }
}

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError;

/** A plain sentence for anything thrown, for a toast or a status line. */
export function plainMessage(e: unknown): string {
  if (isApiError(e)) return e.message;
  return 'Something went wrong. Try again.';
}

const SERVER_WORDS: Record<string, string> = {
  'unknown job': 'This job could not be found. It may have been renamed or removed.',
  'not found': 'The studio does not have what the page asked for.',
  'nothing to send': 'There is nothing to send yet. Add a note, mark a scene as good, or approve the film.',
  'no such film': 'That version of the film is no longer there.',
  'no such frame': 'That picture is no longer there.',
  'too large': 'That was too large to send in one go.',
};

/** Turns a refused answer from the server into an ApiError with a plain message. */
export function errorFromResponse(status: number, data: unknown): ApiError {
  const body = (data && typeof data === 'object' ? data : {}) as { error?: unknown; problems?: unknown; film_modified?: unknown };
  const said = typeof body.error === 'string' ? body.error : '';
  const problems = Array.isArray(body.problems) ? body.problems.filter((p): p is string => typeof p === 'string') : [];
  const sentence = SERVER_WORDS[said] ?? (/^[A-Z].*[.!?]$/.test(said) ? said : '');
  if (status === 409) {
    return new ApiError('stale', sentence || 'The film has changed since these changes were made, so they were not saved. Reload the film to carry on.', {
      status, problems, filmModified: typeof body.film_modified === 'number' ? body.film_modified : null,
    });
  }
  if (status === 404) return new ApiError('not-found', sentence || 'The studio does not have what the page asked for.', { status, problems });
  if (status === 400) return new ApiError('refused', sentence || 'The studio could not accept that. Check it and try again.', { status, problems: problems.length ? problems : sentence ? [sentence] : [] });
  return new ApiError('failed', sentence || `The studio ran into a problem (code ${status}). Try again in a moment.`, { status, problems });
}

export const offlineError = () =>
  new ApiError('offline', 'The studio is not answering. Check that it is still running on this computer, then try again.');
