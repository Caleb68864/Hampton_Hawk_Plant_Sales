interface ApiErrorEnvelope {
  errors?: string[];
}

interface ApiErrorResponse {
  data?: ApiErrorEnvelope;
  statusText?: string;
}

interface ApiErrorLike {
  response?: ApiErrorResponse;
  request?: unknown;
  code?: string;
  message?: string;
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
