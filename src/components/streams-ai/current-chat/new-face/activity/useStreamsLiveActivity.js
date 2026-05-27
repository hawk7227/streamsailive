"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createInitialActivityState,
  pushStreamsActivity,
  updateStreamsActivity,
  completeStreamsActivity,
  failStreamsActivity,
  clearStreamsActivity,
} from "../runtime/streamsActivityBus";
import { subscribeToStreamsActivityEvents, emitNetworkActivity } from "../runtime/streamsGlobalActivityBridge";
import { STREAMS_ACTIVITY_PHASES } from "../runtime/streamsActivityEvents";

export function useStreamsLiveActivity(initialState) {
  const [activityState, setActivityState] = useState(() => initialState || createInitialActivityState());

  const actions = useMemo(() => ({
    push(input) {
      setActivityState((state) => pushStreamsActivity(state, input));
    },

    update(patch) {
      setActivityState((state) => updateStreamsActivity(state, patch));
    },

    complete(patch) {
      setActivityState((state) => completeStreamsActivity(state, patch));
    },

    fail(patch) {
      setActivityState((state) => failStreamsActivity(state, patch));
    },

    clear() {
      setActivityState((state) => clearStreamsActivity(state));
    },
  }), []);

  useEffect(() => {
    const unsubscribe = subscribeToStreamsActivityEvents((event) => {
      if (!event) return;

      if (event.action === "complete") {
        setActivityState((state) => completeStreamsActivity(state, event));
        return;
      }

      if (event.action === "fail") {
        setActivityState((state) => failStreamsActivity(state, event));
        return;
      }

      if (event.action === "update") {
        setActivityState((state) => updateStreamsActivity(state, event));
        return;
      }

      setActivityState((state) => pushStreamsActivity(state, event));
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const offline = () => emitNetworkActivity(STREAMS_ACTIVITY_PHASES.FAILED, "You are offline.");
    const online = () => emitNetworkActivity(STREAMS_ACTIVITY_PHASES.COMPLETE, "Back online");

    window.addEventListener("offline", offline);
    window.addEventListener("online", online);

    return () => {
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
    };
  }, []);

  return {
    activityState,
    activeActivity: activityState.active,
    activityEvents: activityState.events,
    lastCompletedActivity: activityState.lastCompleted,
    lastFailedActivity: activityState.lastFailed,
    activityActions: actions,
  };
}
