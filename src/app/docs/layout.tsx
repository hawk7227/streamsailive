import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "API Documentation - StreamsAI",
  description: "Complete reference for the StreamsAI API.",
};

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-black">
        {children}
    </div>
  );
}
