import type { Revalidation } from "./report";

/**
 * Asks the site to refresh its cached game data (src/app/api/revalidate).
 * Never throws: a failed request only means pages refresh on their own
 * schedule.
 */
export async function revalidateSite(
  siteUrl: string | undefined,
  secret: string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<{ result: Revalidation; detail?: string }> {
  if (!siteUrl || !secret) return { result: "not-configured" };
  try {
    const response = await fetchImpl(new URL("/api/revalidate", siteUrl), {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(15_000),
    });
    return response.ok
      ? { result: "done" }
      : { result: "failed", detail: `HTTP ${response.status}` };
  } catch (error) {
    return {
      result: "failed",
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}
