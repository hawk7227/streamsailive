"use client";

import Navbar from "@/components/layout/Navbar";
import StreamsWorkspaceLanding from "@/components/home/StreamsWorkspaceLanding";
import LandingBrainRuntimeBridge from "@/components/home/LandingBrainRuntimeBridge";

export default function Home() {
  return (
    <>
      <Navbar />
      <LandingBrainRuntimeBridge />
      <StreamsWorkspaceLanding />
    </>
  );
}
