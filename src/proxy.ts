import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Define public routes that do not require authentication
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
  "/.well-known/workflow(.*)",
]);

/**
 * Next.js 16 Proxy convention for edge routing and Clerk session validation.
 *
 * NOTE: Proxy-level checks provide defense-in-depth at the edge, but NEVER replace
 * server-side authentication (requireAuth) and resource authorization (requireContractOwnership)
 * inside Route Handlers and Server Actions.
 */
export const proxy = clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export default proxy;

export const config = {
  matcher: [
    // Skip Next.js internals, workflow internal routes, and all static files
    "/((?!_next|\\.well-known/workflow|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
