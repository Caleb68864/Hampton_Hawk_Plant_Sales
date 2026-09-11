interface ApiErrorEnvelope {
  errors?: string[];
}

interface ApiErrorResponse {
  data?: ApiErrorEnvelope;
  statusText?: string;
}

interface ApiErrorLike {
  response?: ApiErrorResponse & { status?: number };
  request?: unknown;
  code?: string;
  message?: string;
}

/**
 * The error every API helper rejects with. Carries the volunteer-facing message plus
 * the HTTP status and axios code so callers can still branch on "session expired"
 * (401 -> login) or "never reached the server" without re-parsing the message.
 */
export interface ApiError extends Error {
  status?: number;
  code?: string;
}

export function toApiError(error: ApiErrorLike): ApiError {
  const wrapped: ApiError = new Error(getApiErrorMessage(error));
  wrapped.status = error.response?.status;
  wrapped.code = error.code;
  return wrapped;
}

// Axios codes for "the request never came back". On sale day these are the common
// case (LAN drops, AP handoff), and they must not read as a generic server error --
// mapToActionableError keys off the words "timed out" and "network" to tell the
// volunteer to check the connection rather than retry blindly.
const TIMEOUT_CODES = new Set(['ECONNABORTED', 'ETIMEDOUT']);

export function getApiErrorMessage(error: ApiErrorLike): string {
  if (!error.response) {
    if (error.code && TIMEOUT_CODES.has(error.code)) {
      return 'The request timed out before the server responded.';
    }
    if (error.code === 'ERR_NETWORK' || error.request) {
      return 'Network error — could not reach the server.';
    }
  }

  const errors = error.response?.data?.errors?.filter((value): value is string => Boolean(value?.trim()));

  if (errors && errors.length > 0) {
    const [primaryError, ...remainingErrors] = errors;
    if (remainingErrors.length === 0) {
      return primaryError;
    }
    return `${primaryError} (${errors.join(' | ')})`;
  }

  const statusText = error.response?.statusText?.trim();
  return statusText || 'An error occurred';
}
