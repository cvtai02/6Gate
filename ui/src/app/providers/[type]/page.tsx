"use client";
import { Suspense, useEffect } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";

function Redirect() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  useEffect(() => {
    const q = new URLSearchParams({ type: params.type as string });
    searchParams.forEach((val, key) => { if (key !== "type") q.set(key, val); });
    router.replace(`/providers?${q.toString()}`);
  }, []);
  return null;
}

export default function ProviderTypePage() {
  return <Suspense><Redirect /></Suspense>;
}
