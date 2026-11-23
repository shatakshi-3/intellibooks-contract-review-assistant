/**
 * Authentication protection utilities.
 *
 * These functions verify Clerk sessions and enforce ownership
 * on every protected resource access.
 *
 * Key security rules:
 * - userId is ALWAYS derived from the verified Clerk session
 * - NEVER trust userId from request body, params, or headers
 * - Ownership check returns 404 (not 403) to avoid leaking resource existence
 */

import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { users, contracts } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { AppError } from "@/lib/errors";
import { isDemoMode, DEMO_USER, DemoService } from "@/demo";

/**
 * Verify the Clerk session and return the internal user record.
 * Throws 401 if not authenticated.
 */
export async function requireAuth(): Promise<{
  userId: string;    // Internal UUID
  clerkId: string;   // Clerk's user ID
}> {
  if (isDemoMode()) {
    return { userId: DEMO_USER.id, clerkId: DEMO_USER.clerkId };
  }

  const { userId: clerkId } = await auth();

  if (!clerkId) {
    throw AppError.unauthorized();
  }

  // Look up internal user record
  const user = await db
    .select({ id: users.id, clerkId: users.clerkId })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);

  if (user.length === 0) {
    // User exists in Clerk but not synced to our DB yet
    // This can happen if the webhook hasn't fired yet
    throw AppError.unauthorized(
      "User account is being set up. Please try again in a moment."
    );
  }

  return { userId: user[0].id, clerkId: user[0].clerkId };
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
  try {
    const contract = await db
      .select()
      .from(contracts)
      .where(and(eq(contracts.id, contractId), eq(contracts.userId, userId)))
      .limit(1);

    if (contract.length > 0) {
      return contract[0];
    }
  } catch (error) {
    if (!isDemoMode()) throw error;
  }

  if (isDemoMode()) {
    const demoContract = DemoService.getContractById(contractId);
    if (demoContract) {
      return demoContract;
    }
  }

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
  if (isDemoMode()) {
    return;
  }

  const user = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (user.length === 0 || user[0].role !== requiredRole) {
    throw AppError.forbidden("Insufficient permissions");
  }
}
