import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const DEMO_COOKIE = "hannibal-demo";
const PLAYGROUND_COOKIE = "hannibal-playground";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
  "/api/waitlist(.*)",
  "/demo(.*)",
  "/playground(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  const { pathname } = request.nextUrl;

  // Block direct sign-up unless coming from a Clerk invitation link
  if (pathname.startsWith("/sign-up") && !request.nextUrl.searchParams.has("__clerk_ticket")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Set demo cookie for /demo routes so tRPC/chat can identify demo visitors
  if (pathname === "/demo" || pathname.startsWith("/demo/")) {
    const response = NextResponse.next();
    if (!request.cookies.get(DEMO_COOKIE)) {
      response.cookies.set(DEMO_COOKIE, "true", {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      });
    }
    return response;
  }

  // Set playground cookie for /playground routes — same auth fallback as demo,
  // but tracked separately so the chat route can apply normal (not stricter) rate
  // limits and tRPC can pick the right project.
  if (pathname === "/playground" || pathname.startsWith("/playground/")) {
    const response = NextResponse.next();
    if (!request.cookies.get(PLAYGROUND_COOKIE)) {
      response.cookies.set(PLAYGROUND_COOKIE, "true", {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      });
    }
    return response;
  }

  if (!isPublicRoute(request)) {
    // Allow API/tRPC requests from demo or playground visitors — those cookies
    // are set, and the tRPC context / chat route handle the auth fallback.
    const hasDemoCookie = request.cookies.get(DEMO_COOKIE)?.value === "true";
    const hasPlaygroundCookie =
      request.cookies.get(PLAYGROUND_COOKIE)?.value === "true";
    if (!hasDemoCookie && !hasPlaygroundCookie) {
      await auth.protect();
    }
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
