/**
 * Demo Processing Configuration & Environment Guards.
 *
 * Demo mode replaces unavailable external cloud services (Vercel Blob, OpenRouter AI)
 * with deterministic local processing results, WITHOUT compromising user authentication
 * or multi-tenant database isolation.
 *
 * Every user maintains their own independent Clerk account and PostgreSQL records.
 */

export const isDemoMode = (): boolean => {
  // 1. Strict production safeguard: NEVER activate in production environments
  if (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production" ||
    process.env.VERCEL === "1"
  ) {
    return false;
  }

  // 2. Automated test suite default
  if (process.env.NODE_ENV === "test") {
    return false;
  }

  // 3. Explicit local opt-in flag
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
    return true;
  }

  // 4. Missing or placeholder OpenRouter key triggers deterministic demo processing locally
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (!openRouterKey || openRouterKey.includes("mock") || openRouterKey.includes("placeholder")) {
    return true;
  }

  return false;
};
