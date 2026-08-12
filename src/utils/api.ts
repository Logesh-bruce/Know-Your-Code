export const REQUEST_TIMEOUT_MS = 45_000;

export class ApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function postJson<T>(
  url: string,
  body: unknown,
  timeoutMs = REQUEST_TIMEOUT_MS
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      throw new ApiError(
        payload?.error ?? `Request failed (${response.status})`,
        response.status
      );
    }

    return (await response.json()) as T;
  } catch (err) {
    if (controller.signal.aborted) {
      throw new ApiError(
        `Request timed out after ${timeoutMs / 1000}s — the server may be slow. Try again, or check your network connection.`,
        408
      );
    }
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      err instanceof Error
        ? err.message
        : "Network error — could not reach the server",
      0
    );
  } finally {
    clearTimeout(timer);
  }
}