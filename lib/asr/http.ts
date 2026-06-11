export const defaultAsrRequestTimeoutMs = 45_000;

export function getAsrRequestTimeoutMs() {
  const value = Number(process.env.ASR_REQUEST_TIMEOUT_MS);

  if (Number.isFinite(value) && value >= 1000) {
    return Math.min(value, 120_000);
  }

  return defaultAsrRequestTimeoutMs;
}

export function describeAsrRequestError(error: unknown) {
  if (error instanceof DOMException && error.name === "TimeoutError") {
    return `ASR request timed out after ${Math.round(getAsrRequestTimeoutMs() / 1000)}s`;
  }

  if (error instanceof DOMException && error.name === "AbortError") {
    return "ASR request was aborted";
  }

  return error instanceof Error ? error.message : "ASR request failed";
}
