"use client";

import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Hero from "@/components/home/Hero";
import Features from "@/components/home/Features";
import Products from "@/components/home/Products";
import Testimonials from "@/components/home/Testimonials";
import CTA from "@/components/home/CTA";

export default function Home() {
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
