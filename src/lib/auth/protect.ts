/**
 * Authentication protection utilities.
 *
 * These functions verify Clerk sessions and enforce ownership
 * on every protected resource access.
 *
 * Key security rules:
 * - userId is ALWAYS derived from the verified Clerk session
 * - NEVER trust userId from request body, params, headers, or cookies
 * - Ownership check returns 404 (not 403) to avoid leaking resource existence
 */

import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { users, contracts } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { AppError } from "@/lib/errors";

/**
 * Verify the Clerk session and return the internal user record.
 * Throws 401 if not authenticated.
 */
export async function requireAuth(): Promise<{
  userId: string; // Internal UUID
  clerkId: string; // Clerk's user ID
}> {
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    throw AppError.unauthorized("Authentication required");
  }

  // Look up internal user record
  const existingUsers = await db
    .select({ id: users.id, clerkId: users.clerkId })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);

  if (existingUsers.length > 0) {
    return { userId: existingUsers[0].id, clerkId: existingUsers[0].clerkId };
  }

  // Just-In-Time auto-provisioning: If user signed up via Clerk but webhook has not fired yet,
  // sync their user profile immediately into Neon PostgreSQL so local usage never stalls.
  try {
    const clerkUser = await currentUser();
    if (clerkUser) {
      const email =
        clerkUser.emailAddresses?.[0]?.emailAddress ?? `${clerkId}@clerk.user`;
      const name = `${clerkUser.firstName ?? ""} ${clerkUser.lastName ?? ""}`.trim() || null;

      const [newUser] = await db
        .insert(users)
        .values({
          clerkId,
          email,
          name,
          role: "user",
        })
        .onConflictDoUpdate({
          target: users.clerkId,
          set: { updatedAt: new Date() },
        })
        .returning({ id: users.id, clerkId: users.clerkId });

      return { userId: newUser.id, clerkId: newUser.clerkId };
    }
  } catch {
    // If Clerk API fails, throw unauthorized
  }

  throw AppError.unauthorized(
    "User account is being set up. Please try again in a moment."
  );
}

/**
 * Verify that the authenticated user owns the specified contract.
 * Returns the contract record if owned, throws 404 otherwise.
 *
 * Uses 404 instead of 403 to prevent leaking existence of other users' contracts.
 */
export async function requireContractOwnership(
  contractId: string,
  userId: string
) {
  const contract = await db
    .select()
    .from(contracts)
    .where(and(eq(contracts.id, contractId), eq(contracts.userId, userId)))
    .limit(1);

  if (contract.length > 0) {
    return contract[0];
  }

  // Real server-side isolation: strictly 404 if not found or belongs to another user
  throw AppError.notFound("Contract not found");
}

/**
 * Check if the user has the required role.
 * Used for evaluation dashboard access.
 */
export async function requireRole(
  userId: string,
  requiredRole: string
): Promise<void> {
  const user = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (user.length === 0) {
    throw AppError.forbidden("User not found");
  }

  if (user[0].role !== requiredRole && user[0].role !== "admin") {
    throw AppError.forbidden(`Role '${requiredRole}' required`);
  }
}

export function isAdmin(role: string | null | undefined): boolean {
  return role === "admin";
}
