import { describe, it, expect, beforeEach } from "vitest";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

describe("checkRateLimit", () => {
  const testUserId = "user-test-123";

  it("allows requests under the limit", () => {
    const result = checkRateLimit(testUserId, "upload");
    expect(result.limited).toBe(false);
    expect(result.remaining).toBe(RATE_LIMITS.upload.maxRequests - 1);
  });

  it("blocks requests once limit is reached", () => {
    const userForLimit = "user-limit-target";
    const max = RATE_LIMITS.review.maxRequests;

    for (let i = 0; i < max; i++) {
      const res = checkRateLimit(userForLimit, "review");
      expect(res.limited).toBe(false);
    }

    // Next request exceeds limit
    const blocked = checkRateLimit(userForLimit, "review");
    expect(blocked.limited).toBe(true);
    expect(blocked.remaining).toBe(0);
    expect(blocked.resetMs).toBeGreaterThan(0);
  });

  it("isolates rate limits between different users", () => {
    const userA = "user-a";
    const userB = "user-b";
    const max = RATE_LIMITS.review.maxRequests;

    for (let i = 0; i < max; i++) {
      checkRateLimit(userA, "review");
    }

    expect(checkRateLimit(userA, "review").limited).toBe(true);
    // User B should still be allowed
    expect(checkRateLimit(userB, "review").limited).toBe(false);
  });
});
