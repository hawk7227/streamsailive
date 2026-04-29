"use client";

/**
 * src/app/streams/layout.tsx
 *
 * Standalone Streams panel layout.
 * TEMP TEST MODE:
 * - /streams is public while testing DigitalOcean frontend deployment.
 * - Auth system is not removed.
 * - Dashboard/auth-protected areas remain controlled elsewhere.
 * - Re-enable auth guard here before production lock-down.
 */

import { C } from "@/components/streams/tokens";

export default function StreamsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex flex-col min-h-screen w-full overflow-hidden"
      style={{ background: C.bg, color: C.t1 }}
    >
      {children}
    </div>
  );
}
