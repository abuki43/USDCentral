type ParsedBackendError = {
  message?: string;
  code?: string;
  details?: unknown;
};

const parseJsonMaybe = (raw: string) => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const parseBackendErrorText = (text: string): ParsedBackendError | null => {
  if (!text) return null;

  let data = parseJsonMaybe(text);
  if (typeof data === 'string') {
    data = parseJsonMaybe(data);
  }

  if (!data) {
    const trimmed = text.trim();
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start !== -1 && end > start) {
      data = parseJsonMaybe(trimmed.slice(start, end + 1));
      if (typeof data === 'string') {
        data = parseJsonMaybe(data);
      }
    }
  }

  if (data && typeof data === 'object') {
    return data as ParsedBackendError;
  }

  return null;
};

export const buildBackendError = (text: string, status: number) => {
  const parsed = parseBackendErrorText(text);
  if (!parsed || typeof parsed !== 'object') return null;

  const message =
    (parsed as ParsedBackendError).message || `Request failed (${status})`;
  const error = new Error(message) as Error & {
    code?: string;
    details?: unknown;
    status?: number;
  };

  if ((parsed as ParsedBackendError).code) error.code = parsed.code;
  if ((parsed as ParsedBackendError).details) error.details = parsed.details;
  error.status = status;
  return error;
};

export const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return fallback;
};
