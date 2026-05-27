"use client";

import { useMemo, useState } from "react";
import {
  createInitialActivityState,
  pushStreamsActivity,
  updateStreamsActivity,
  completeStreamsActivity,
  failStreamsActivity,
  clearStreamsActivity,
} from "../runtime/streamsActivityBus";

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

  return {
    activityState,
    activeActivity: activityState.active,
    activityEvents: activityState.events,
    lastCompletedActivity: activityState.lastCompleted,
    lastFailedActivity: activityState.lastFailed,
    activityActions: actions,
  };
}
