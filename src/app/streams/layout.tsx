"use client";

/**
 * src/app/streams/layout.tsx
 *
 * Standalone Streams panel layout.
 * - Auth guard: redirects to /login if no session
 * - No existing app sidebar — fully standalone
 * - Full-viewport fixed shell
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { C } from "@/components/streams/tokens";

export default function StreamsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: C.bg }}
      >
        <div
          className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: C.acc, borderTopColor: "transparent" }}
        />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div
      className="flex flex-col min-h-screen w-full overflow-hidden"
      style={{ background: C.bg, color: C.t1 }}
    >
      {children}
    </div>
  );
}
