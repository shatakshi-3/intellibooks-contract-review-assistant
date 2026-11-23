/**
 * Demo Mode Configuration.
 *
 * Automatically activated if NEXT_PUBLIC_DEMO_MODE=true or if Clerk publishable
 * key is missing / contains placeholder credentials.
 */

export const isDemoMode = (): boolean => {
  if (process.env.NODE_ENV === "test") return false;
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") return true;
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

export const DEMO_USER = {
  id: "usr_00000000-0000-0000-0000-000000000001",
  clerkId: "user_demo_intellibooks",
  email: "demo@intellibooks.dev",
  name: "Demo Legal Counsel",
  role: "admin",
};
