"use client";
// Cache bust: 2026-04-28T23:33:00Z - Force full rebuild

import Navbar from "@/components/layout/Navbar";
import Hero from "@/components/home/Hero";
import Features from "@/components/home/Features";

export default function Home() {
  return (
    <>
      <Navbar />
      <main id="home-fit-page">
        <Hero />
        <Features />
      </main>
    </>
  );
}
