import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Auth is fully client-side now: the token lives in localStorage and is attached as an
// `Authorization: Bearer` header by the fetch interceptor (lib/auth.ts); route
// protection is handled by the AuthBootstrap client guard. This edge middleware no
// longer reads sessions — it only answers CORS preflights and otherwise passes through.
export async function proxy(req: NextRequest) {
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
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
