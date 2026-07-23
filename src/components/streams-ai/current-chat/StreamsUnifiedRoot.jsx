"use client";

import StreamsUniversalExperience from "./StreamsUniversalExperience";
import WorkspaceNavigationCommandBridge from "./WorkspaceNavigationCommandBridge";

export default function StreamsUnifiedRoot() {
  return (
    <>
      <WorkspaceNavigationCommandBridge />
      <StreamsUniversalExperience />
    </>
  );
}
