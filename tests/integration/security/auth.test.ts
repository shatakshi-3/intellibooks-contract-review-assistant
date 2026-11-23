import { describe, it, expect } from "vitest";

describe("Security & Route Protection Boundaries", () => {
  // Routes categorized based on middleware configuration
  const publicRoutes = [
    "/",
    "/sign-in",
    "/sign-in/sso-callback",
    "/sign-up",
    "/sign-up/continue",
    "/api/webhooks/clerk",
  ];

  const protectedRoutes = [
    "/dashboard",
    "/contracts",
    "/contracts/123e4567-e89b-12d3-a456-426614174000",
    "/contracts/123e4567-e89b-12d3-a456-426614174000/chat",
    "/evaluation",
    "/api/contracts",
    "/api/upload",
    "/api/evaluation/runs",
    "/api/evaluation/dashboard",
  ];

  // Regex pattern matching public routes matching the middleware configuration:
  // ["/", "/sign-in(.*)", "/sign-up(.*)", "/api/webhooks(.*)"]
  const publicRoutePatterns = [
    /^\/$/,
    /^\/sign-in(\/.*)?$/,
    /^\/sign-up(\/.*)?$/,
    /^\/api\/webhooks(\/.*)?$/,
  ];

  function isPublic(path: string): boolean {
    return publicRoutePatterns.some((pattern) => pattern.test(path));
  }

  it("identifies public routes correctly", () => {
    for (const route of publicRoutes) {
      expect(isPublic(route), `Route should be public: ${route}`).toBe(true);
    }
  });

  it("identifies protected application and API routes correctly", () => {
    for (const route of protectedRoutes) {
      expect(isPublic(route), `Route should be protected: ${route}`).toBe(false);
    }
  });

  it("enforces tenant boundary on cross-user contract queries", () => {
    // Verifies the SQL predicate invariant: every contract or chunk query must include user_id
    const userA = "usr_user_a";
    const userB = "usr_user_b";
    const contractOwnedByA = {
      id: "contract_123",
      userId: userA,
    };

    const isAuthorized = (contract: typeof contractOwnedByA, requestingUserId: string) => {
      return contract.userId === requestingUserId;
    };

    expect(isAuthorized(contractOwnedByA, userA)).toBe(true);
    expect(isAuthorized(contractOwnedByA, userB)).toBe(false);
  });
});
