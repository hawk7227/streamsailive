"use client";

import StreamsUniversalProjectWorkspace from "./StreamsUniversalProjectWorkspace";
import WebsiteLaunchWorkspace from "./WebsiteLaunchWorkspace";

export default function StreamsDestinationWorkspace(props) {
  if (props?.destination === "website-builder") {
    return <><WebsiteLaunchWorkspace /><style jsx global>{`
      .withNewChatVisualSample>.newChatNavigationVisualSample{display:none!important}
      .withNewChatVisualSample>.streamsDestinationFrame{margin-left:0!important;width:100%!important}
    `}</style></>;
  }
  return <StreamsUniversalProjectWorkspace {...props} />;
}
