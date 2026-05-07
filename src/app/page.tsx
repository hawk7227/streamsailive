// Cache bust: 2026-04-28T23:33:00Z - Force full rebuild

import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Hero from "@/components/home/Hero";
import Features from "@/components/home/Features";
import Products from "@/components/home/Products";
import Testimonials from "@/components/home/Testimonials";
import CTA from "@/components/home/CTA";
import { StreamsWorkspaceShell } from "@/components/streams/workspace";
import { isStandaloneStreamsPanelMode } from "@/lib/streams/standalone-panel-mode";

export default function Home() {
  if (isStandaloneStreamsPanelMode()) {
    return <StreamsWorkspaceShell />;
  }

  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Features />
        <Products />
        <Testimonials />
        <CTA />
      </main>
      <Footer />
    </>
  );
}
