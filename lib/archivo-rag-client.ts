/** Only retry a rejected rate-limited request. Never retry ambiguous writes. */
export const fetchRagRequest: typeof fetch = async (input, init) => {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(input, { ...init, signal: AbortSignal.timeout(240_000) });
    if (response.status !== 429 || attempt >= 2) return response;
    const seconds = Number(response.headers.get("Retry-After"));
    await response.body?.cancel();
    await new Promise(resolve => setTimeout(resolve, Math.min(65, Math.max(5, seconds || 60)) * 1000));
  }
};
