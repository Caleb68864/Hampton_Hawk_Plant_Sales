interface ApiErrorEnvelope {
  errors?: string[];
}

interface ApiErrorResponse {
  data?: ApiErrorEnvelope;
  statusText?: string;
}

interface ApiErrorLike {
  response?: ApiErrorResponse;
}

export function getApiErrorMessage(error: ApiErrorLike): string {
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
