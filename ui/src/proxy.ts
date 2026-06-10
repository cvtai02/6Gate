import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const BACKEND = process.env.API_URL ?? "http://localhost:20130";

async function checkSession(session: string): Promise<boolean> {
  try {
    const res = await fetch(`${BACKEND}/api/auth/me`, {
      headers: { authorization: `Bearer ${session}` },
    });
    const data = (await res.json()) as { ok?: boolean };
    return data.ok === true;
  } catch {
    return false;
  }
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (req.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type,Authorization,X-System-Secret",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  const session = req.cookies.get("session")?.value;

  // API routes: forward session as Bearer token for the backend guard to validate
  if (pathname.startsWith("/api/")) {
    if (session) {
      const headers = new Headers(req.headers);
      headers.set("authorization", `Bearer ${session}`);
      return NextResponse.next({ request: { headers } });
    }
    return NextResponse.next();
  }

  // Login page: redirect to home if already authenticated
  if (pathname === "/login") {
    if (session && (await checkSession(session))) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  // All other UI routes: require a valid session
  if (!session || !(await checkSession(session))) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
