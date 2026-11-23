import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { Webhook } from "svix";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logger";

interface ClerkEmailAddress {
  email_address: string;
  id: string;
}

interface ClerkWebhookEventData {
  id: string;
  email_addresses?: ClerkEmailAddress[];
  primary_email_address_id?: string;
  first_name?: string | null;
  last_name?: string | null;
  public_metadata?: {
    role?: string;
  };
}

interface ClerkWebhookEvent {
  data: ClerkWebhookEventData;
  type: "user.created" | "user.updated" | "user.deleted" | string;
}

export async function POST(req: Request) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

  if (!webhookSecret) {
    logger.error("Missing CLERK_WEBHOOK_SECRET environment variable");
    return NextResponse.json(
      { error: "Webhook secret is not configured" },
      { status: 500 }
    );
  }

  // Get Svix verification headers
  const headerPayload = await headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json(
      { error: "Missing required svix headers" },
      { status: 400 }
    );
  }

  // Get raw body as text
  const payload = await req.text();

  let evt: ClerkWebhookEvent;

  try {
    const wh = new Webhook(webhookSecret);
    evt = wh.verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as unknown as ClerkWebhookEvent;
  } catch (err) {
    logger.error("Clerk webhook signature verification failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Invalid webhook signature" },
      { status: 400 }
    );
  }

  const eventType = evt.type;
  const { id: clerkId, email_addresses, first_name, last_name, public_metadata } = evt.data;

  const email = email_addresses?.[0]?.email_address || "";
  const name = [first_name, last_name].filter(Boolean).join(" ").trim() || null;
  const role = public_metadata?.role === "admin" ? "admin" : "user";

  try {
    switch (eventType) {
      case "user.created": {
        if (!email) {
          logger.warn("User created webhook received without email", { clerkId });
        }
        await db
          .insert(users)
          .values({
            clerkId,
            email: email || `${clerkId}@placeholder.local`,
            name,
            role,
          })
          .onConflictDoUpdate({
            target: users.clerkId,
            set: {
              email: email || `${clerkId}@placeholder.local`,
              name,
              role,
              updatedAt: new Date(),
            },
          });

        logger.info("User synced on user.created", { clerkId, email });
        break;
      }

      case "user.updated": {
        await db
          .update(users)
          .set({
            email: email || undefined,
            name,
            role,
            updatedAt: new Date(),
          })
          .where(eq(users.clerkId, clerkId));

        logger.info("User updated on user.updated", { clerkId });
        break;
      }

      case "user.deleted": {
        await db.delete(users).where(eq(users.clerkId, clerkId));
        logger.info("User deleted on user.deleted", { clerkId });
        break;
      }

      default:
        logger.info(`Unhandled Clerk webhook event type: ${eventType}`, { clerkId });
        break;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Error processing Clerk webhook event", {
      eventType,
      clerkId,
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: "Internal database processing error" },
      { status: 500 }
    );
  }
}
