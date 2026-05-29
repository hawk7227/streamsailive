import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import QueryProvider from "@/providers/QueryProvider";

const inter = { variable: "--font-inter", className: "font-inter" };

export const metadata: Metadata = {
  title: "StreamsAI - Create Stunning Content with AI",
  description: "Transform your ideas into stunning videos, images, voiceovers, and scripts with AI. One platform, unlimited creativity.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} antialiased`}
        suppressHydrationWarning
      >
        <QueryProvider>
          <AuthProvider>{children}</AuthProvider>
        </QueryProvider>
            </body>
    </html>
  );
}
