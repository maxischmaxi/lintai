/**
 * Creates a debounced function that delays invoking the provided function
 * until after the specified wait time has elapsed since the last invocation.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  waitMs: number,
): {
  (...args: Parameters<T>): void;
  cancel: () => void;
  flush: () => void;
} {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;

  const debounced = (...args: Parameters<T>): void => {
    lastArgs = args;

    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      if (lastArgs) {
        fn(...lastArgs);
        lastArgs = null;
      }
      timeoutId = null;
    }, waitMs);
  };

  debounced.cancel = (): void => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    lastArgs = null;
  };

  debounced.flush = (): void => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (lastArgs) {
      fn(...lastArgs);
      lastArgs = null;
    }
  };

  return debounced;
}

/**
 * Creates an async debounced function.
 * Each call returns a promise that resolves when the debounced function executes.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function debounceAsync<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  waitMs: number,
): (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let pendingPromise: {
    resolve: (value: Awaited<ReturnType<T>>) => void;
    reject: (error: unknown) => void;
  } | null = null;

  return (...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> => {
    return new Promise((resolve, reject) => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }

      pendingPromise = { resolve, reject };

      timeoutId = setTimeout(async () => {
        try {
          const result = await fn(...args);
          pendingPromise?.resolve(result as Awaited<ReturnType<T>>);
        } catch (error) {
          pendingPromise?.reject(error);
        } finally {
          timeoutId = null;
          pendingPromise = null;
        }
      }, waitMs);
    });
  };
}
