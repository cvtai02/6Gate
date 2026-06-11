"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getToken, installAuthFetch } from "@/lib/auth";

// Installs the auth fetch interceptor and enforces client-side route protection:
// any route other than /login requires a token in localStorage, else redirect to login.
// Renders nothing.
export function AuthBootstrap() {
  const pathname = usePathname();
  const router = useRouter();

  // Install the interceptor as early as possible on the client.
  installAuthFetch();

  useEffect(() => {
    if (pathname === "/login") return;
    if (!getToken()) router.replace("/login");
  }, [pathname, router]);

  return null;
}
