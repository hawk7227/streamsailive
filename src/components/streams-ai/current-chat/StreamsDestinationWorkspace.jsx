"use client";

import StreamsUniversalProjectWorkspace from "./StreamsUniversalProjectWorkspace";
import WebsiteLaunchWorkspace from "./WebsiteLaunchWorkspace";

export default function StreamsDestinationWorkspace(props) {
  if (props?.destination === "website-builder") {
    return <WebsiteLaunchWorkspace />;
  }
  return <StreamsUniversalProjectWorkspace {...props} />;
}
