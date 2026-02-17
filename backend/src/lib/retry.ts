type RetryOptions = {
  retries?: number;
  delayMs?: number;
  factor?: number;
  maxDelayMs?: number;
  shouldRetry?: (error: unknown) => boolean;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const withRetry = async <T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
) => {
  const retries = options.retries ?? 2;
  const delayMs = options.delayMs ?? 250;
  const factor = options.factor ?? 2;
  const maxDelayMs = options.maxDelayMs ?? 2000;
  const shouldRetry =
    options.shouldRetry ?? (() => true);

  let attempt = 0;
  let lastError: unknown;

  while (attempt <= retries) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === retries || !shouldRetry(error)) {
        break;
      }
      const wait = Math.min(delayMs * Math.pow(factor, attempt), maxDelayMs);
      await sleep(wait);
      attempt += 1;
    }
  }

  throw lastError;
};
