"use client";

/**
 * ChatTab.tsx — Phase 9 Implementation
 * 
 * PHASE 9: Concurrent Artifact Rendering
 * - Split-panel: 65% chat / 35% preview (desktop)
 * - Tabs: Preview/Code (mobile)
 * - Activity phase: Real work steps with checkmarks
 * - Response phase: Word-by-word streaming
 * - Concurrent rendering: Code + images/videos load in parallel
 * - Auto-scroll: Pauses when user scrolls up, "Jump to Latest" button
 * - Project-aware: Uses memory, tasks, artifacts from Phases 1-8
 */

import React, { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import { Phase9ChatControlPlane } from "../artifacts/Phase9ChatControlPlane";
import { C, R } from "../tokens";

export default function ChatTab() {
  const [userId, setUserId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const supabaseRef = useRef<any>(null);

  // Initialize auth on mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL || "",
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
        );
        supabaseRef.current = supabase;

        // Listen for auth changes
        const { data: { subscription } } = (supabase.auth as any).onAuthStateChange(
          (event: any, session: any) => {
            if (session?.user) {
              setUserId(session.user.id);
              // TODO: Get projectId from query params, context, or active project
              setProjectId("default-project");
            }
            setLoading(false);
          }
        );

        return () => subscription?.unsubscribe();
      } catch (error) {
        console.error("Auth init error:", error);
        setLoading(false);
      }
    };

    const cleanup = initAuth();
    return () => {
      cleanup?.then(fn => fn?.());
    };
  }, []);

  // Loading state
  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          color: C.t3,
          fontSize: 13,
        }}
      >
        Initializing Phase 9 Chat...
      </div>
    );
  }

  // No user
  if (!userId) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          color: C.t4,
          fontSize: 13,
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div>Please log in to use Chat</div>
        <button
          onClick={() => window.location.href = "/login"}
          style={{
            padding: "8px 16px",
            borderRadius: R.r1,
            border: "none",
            background: C.acc,
            color: "#fff",
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          Go to Login
        </button>
      </div>
    );
  }

  // Render Phase 9 Chat Control Plane
  return (
    <Phase9ChatControlPlane
      projectId={projectId || "default-project"}
      userId={userId}
      onArtifactGenerated={(artifactId) => {
        // Hook for when artifacts are generated
        console.log("Artifact generated:", artifactId);
      }}
    />
  );
}
