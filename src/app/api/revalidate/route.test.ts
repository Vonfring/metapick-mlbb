import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const revalidateTag = vi.fn();
vi.mock("next/cache", () => ({ revalidateTag }));

const { POST } = await import("./route");

const post = (authorization?: string) =>
  POST(
    new Request("https://example.test/api/revalidate", {
      method: "POST",
      headers: authorization ? { Authorization: authorization } : {},
    }),
  );

describe("POST /api/revalidate", () => {
  beforeEach(() => {
    vi.stubEnv("REVALIDATE_SECRET", "correct-horse");
    revalidateTag.mockClear();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("revalidates game data with the right secret", async () => {
    const response = await post("Bearer correct-horse");
    expect(response.status).toBe(200);
    expect(revalidateTag).toHaveBeenCalledWith("game-data", "max");
  });

  it("refuses a wrong or missing secret", async () => {
    expect((await post("Bearer wrong")).status).toBe(401);
    expect((await post("correct-horse")).status).toBe(401);
    expect((await post()).status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("refuses everything when no secret is configured", async () => {
    vi.stubEnv("REVALIDATE_SECRET", "");
    expect((await post("Bearer ")).status).toBe(503);
    expect(revalidateTag).not.toHaveBeenCalled();
  });
});
