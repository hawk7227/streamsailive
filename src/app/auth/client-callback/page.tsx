"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/streams-ai";
  return value;
}

function AuthClientCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Completing sign in…");

  useEffect(() => {
    let active = true;

    async function completeSignIn() {
      const code = searchParams.get("code");
      const next = safeNextPath(searchParams.get("next"));
      if (!code) {
        router.replace("/login?error=Authentication+callback+did+not+include+an+authorization+code.");
        return;
      }

      const supabase = createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!active) return;

      if (error) {
        setMessage(error.message);
        router.replace(`/login?error=${encodeURIComponent(error.message)}`);
        return;
      }

      router.replace(next);
      router.refresh();
    }

    void completeSignIn();
    return () => {
      active = false;
    };
  }, [router, searchParams]);

  return <p>{message}</p>;
}

function CallbackFallback() {
  return <p>Completing sign in…</p>;
}

export default function AuthClientCallbackPage() {
  return (
    <main className="min-h-screen grid place-items-center bg-[#080b18] text-white">
      <Suspense fallback={<CallbackFallback />}>
        <AuthClientCallbackContent />
      </Suspense>
    </main>
  );
}
