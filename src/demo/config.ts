/**
 * Demo Mode Configuration & Production Safeguards.
 *
 * Provides isolated deterministic identities and data for local assignment demonstrations
 * without requiring Clerk, OpenRouter, or Vercel Blob.
 *
 * CRITICAL SECURITY SAFEGUARD:
 * Demo mode is strictly forbidden in production environments.
 */

export interface DemoUser {
  id: string;
  clerkId: string;
  email: string;
  name: string;
  role: string;
  tenantLabel: string;
  organization: string;
}

export const DEMO_USER_1: DemoUser = {
  id: "usr_00000000-0000-0000-0000-000000000001",
  clerkId: "user_demo_counsel_alpha",
  email: "alex.morgan@cloudscale-legal.com",
  name: "Alex Morgan",
  role: "admin",
  tenantLabel: "Tenant A (Primary Counsel)",
  organization: "CloudScale Legal & Compliance",
};

export const DEMO_USER_2: DemoUser = {
  id: "usr_00000000-0000-0000-0000-000000000002",
  clerkId: "user_demo_reviewer_beta",
  email: "sarah.chen@external-audit.com",
  name: "Sarah Chen",
  role: "user",
  tenantLabel: "Tenant B (External Reviewer)",
  organization: "Apex Assurance Partners",
};

export const DEMO_USERS = [DEMO_USER_1, DEMO_USER_2];

// Default user when no session cookie is specified
export const DEMO_USER = DEMO_USER_1;

export const isDemoMode = (): boolean => {
  // 1. Strict production safeguard: NEVER activate in production
  if (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production"
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

  // 4. Missing or placeholder Clerk credentials fallback for local DX
  const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (
    !clerkKey ||
    clerkKey.includes("placeholder") ||
    clerkKey === "pk_test_Y2xlcmsuZXhhbXBsZS5jb20k"
  ) {
    return true;
  }

  return false;
};
