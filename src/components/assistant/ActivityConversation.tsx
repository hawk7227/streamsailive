import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityPhase,
  pickConversationActivity,
  pickActivityLines,
  type ActivityContext,
  type ConversationActivity,
} from "@/lib/assistant-ui/activityConversations";
import "./ActivityConversation.css";

export type ActivityConversationProps = {
  phase: ActivityPhase;
  userText?: string;
  mode?: "chat" | "build" | "image" | "video" | "tool";
  active?: boolean;
  firstOutputVisible?: boolean;
  className?: string;
};

const ROTATE_MS = 1050;
const LONG_WAIT_MS = 2200;
const MAX_RECENT_LINES = 12;

function layoutFromPhase(phase: ActivityPhase): ActivityContext["mode"] {
  if (phase.startsWith("image_")) return "image";
  if (phase.startsWith("video_")) return "video";
  if (phase.startsWith("build_")) return "build";
  if (phase === "tool_running" || phase === "file_reading" || phase === "uploading" || phase === "saving") return "tool";
  return "chat";
}

export function ActivityConversation({
  phase,
  userText,
  mode,
  active = true,
  firstOutputVisible = false,
  className = "",
}: ActivityConversationProps) {
  const startedAtRef = useRef<number>(Date.now());
  const recentLinesRef = useRef<string[]>([]);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [activity, setActivity] = useState<ConversationActivity | null>(null);
  const [lines, setLines] = useState<string[]>([]);

  const resolvedMode = mode ?? layoutFromPhase(phase);

  const context = useMemo<ActivityContext>(
    () => ({
      userText,
      mode: resolvedMode,
      phase,
      elapsedMs,
      recentLineIds: recentLinesRef.current,
    }),
    [userText, resolvedMode, phase, elapsedMs]
  );

  useEffect(() => {
    startedAtRef.current = Date.now();
    recentLinesRef.current = [];

    const nextActivity = pickConversationActivity({
      userText,
      mode: resolvedMode,
      phase,
      elapsedMs: 0,
      recentLineIds: [],
    });

    setActivity(nextActivity);
    setElapsedMs(0);

    if (nextActivity) {
      const nextLines = pickActivityLines(nextActivity, {
        userText,
        mode: resolvedMode,
        phase,
        elapsedMs: 0,
        recentLineIds: [],
      });
      recentLinesRef.current = nextLines;
      setLines(nextLines);
    } else {
      setLines([]);
    }
  }, [phase, userText, resolvedMode]);

  useEffect(() => {
    if (!active || firstOutputVisible || !activity) return;

    const tick = window.setInterval(() => {
      const nextElapsed = Date.now() - startedAtRef.current;
      setElapsedMs(nextElapsed);

      const nextLines = pickActivityLines(activity, {
        ...context,
        elapsedMs: nextElapsed,
        recentLineIds: recentLinesRef.current,
      });

      recentLinesRef.current = [...recentLinesRef.current, ...nextLines].slice(-MAX_RECENT_LINES);
      setLines(nextLines);
    }, ROTATE_MS);

    return () => window.clearInterval(tick);
  }, [active, firstOutputVisible, activity, context]);

  if (!active || firstOutputVisible || !activity || !lines.length || phase === "idle") {
    return null;
  }

  return (
    <section
      className={[
        "activity-conversation",
        `activity-conversation--${activity.layout}`,
        `activity-conversation--${activity.tone}`,
        `activity-conversation--intensity-${activity.intensity}`,
        className,
      ].join(" ")}
      aria-live="polite"
      aria-busy="true"
    >
      <div className="activity-conversation__visual" aria-hidden="true">
        <div className="activity-conversation__orb" />
        <div className="activity-conversation__skeleton">
          <span />
          <span />
          <span />
        </div>
      </div>

      <div className="activity-conversation__copy">
        {lines.map((line, index) => (
          <p
            key={`${line}-${index}-${elapsedMs}`}
            className={`activity-conversation__line activity-conversation__line--${index + 1}`}
          >
            {line}
          </p>
        ))}
      </div>
    </section>
  );
}

export default ActivityConversation;
