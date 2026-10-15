import { createHash, timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { GAME_DATA_TAG } from "@/lib/data/config";

// Called by the data updater after a run that wrote new data
// (docs/activity-updater.md). POST only; other methods get a 405.

/** Fixed-length digests, so the comparison takes the same time for any input. */
const digest = (value: string) => createHash("sha256").update(value).digest();

export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    return Response.json(
      { error: "Revalidation is not configured" },
      { status: 503 },
    );
  }
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ")
    ? header.slice("Bearer ".length)
    : "";
  if (!timingSafeEqual(digest(token), digest(secret))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Pages keep serving the cached copy while a fresh one renders.
  revalidateTag(GAME_DATA_TAG, "max");
  return Response.json({ revalidated: true });
}
